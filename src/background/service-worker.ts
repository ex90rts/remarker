import { createLookupCacheKey } from "../shared/cache-key";
import type { RuntimeMessage, PronunciationResult } from "../shared/messages";
import {
  LLM_STREAM_PORT,
  OpenAiSseParser,
  type LlmStreamClientMessage,
  type LlmStreamEvent,
} from "../shared/llm-stream";
import { stripOuterCodeFence } from "../shared/markdown";
import { getHostname, normalizeUrlKey } from "../shared/url";
import {
  deleteFromStore,
  deleteAudioCache,
  countDueVocabulary,
  getAllFromStore,
  getAllFootprints,
  getFootprint,
  getFromStore,
  getAudioCache,
  getHighlightsForUrl,
  getNextVocabularyReview,
  getReviewQueue,
  getSettings,
  getOptionsDataCounts,
  getVocabularyByCacheKey,
  getVocabularyForUrl as getVocabularyRecordsForUrl,
  importSnapshot,
  putInStore,
  saveSettings,
  saveAudioCache,
  queryFootprints,
  queryHighlights,
  queryVocabulary,
  submitVocabularyReview,
  updateHighlightStatuses,
} from "../shared/repositories/db";
import type {
  AppSettings,
  FootprintListItem,
  FootprintRecord,
  HighlightRecord,
  HighlightStatus,
  LlmProvider,
  SelectionLookupResult,
  VocabularyRecord,
} from "../shared/types";
import {
  getEffectiveLlmConfig,
  getPromptTemplateForSelectionKind,
  SCHEMA_VERSION,
} from "../shared/types";
import {
  getNextReviewReminderAt,
  normalizeVocabularyReview,
} from "../shared/review";
import { detectSpeechLanguage, normalizeWord } from "../shared/word";

const TARGET_LANGUAGE_NAMES: Record<AppSettings["ui"]["language"], string> = {
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  en: "English",
  es: "Spanish",
};

const REVIEW_ALARM = "remarker-review-reminder";

void ensureReviewAlarm();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const cache = await chrome.storage.local.get([
    "globalEnabled",
    "disabledSites",
    "schemaVersion",
  ]);
  await chrome.storage.local.set({
    globalEnabled: cache.globalEnabled ?? true,
    disabledSites: cache.disabledSites ?? [],
    schemaVersion: Math.max(cache.schemaVersion ?? 0, SCHEMA_VERSION),
  });
  await ensureReviewAlarm();
  await refreshReviewBadge();
  if (reason === "install") {
    await chrome.tabs.create({
      url: chrome.runtime.getURL("options.html#settings?onboarding=1"),
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureReviewAlarm();
  void refreshReviewBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REVIEW_ALARM) void handleReviewAlarm();
});

async function ensureReviewAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(REVIEW_ALARM);
  if (existing && existing.periodInMinutes === undefined) return;
  if (existing) await chrome.alarms.clear(REVIEW_ALARM);
  await scheduleNextReviewAlarm();
}

async function handleReviewAlarm(): Promise<void> {
  try {
    await refreshReviewBadge();
  } finally {
    await scheduleNextReviewAlarm();
  }
}

async function scheduleNextReviewAlarm(): Promise<void> {
  const when = new Date(
    getNextReviewReminderAt(new Date().toISOString()),
  ).getTime();
  await chrome.alarms.create(REVIEW_ALARM, { when });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== LLM_STREAM_PORT) return;
  let activeRequest: { requestId: string; controller: AbortController } | undefined;
  port.onMessage.addListener((message: LlmStreamClientMessage) => {
    if (message.type === "cancel") {
      if (activeRequest?.requestId === message.requestId) activeRequest.controller.abort();
      return;
    }
    activeRequest?.controller.abort();
    const controller = new AbortController();
    activeRequest = { requestId: message.requestId, controller };
    const requestId = message.requestId;
    postPortEvent(port, { type: "started", requestId });
    explainSelection(message.payload, {
      signal: controller.signal,
      onChunk: (content) => postPortEvent(port, { type: "chunk", requestId, content }),
    })
      .then((result) => postPortEvent(port, { type: "completed", requestId, result }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        postPortEvent(port, {
          type: "error",
          requestId,
          error: error instanceof Error ? error.message : "Unknown streaming error.",
        });
      })
      .finally(() => {
        if (activeRequest?.requestId === requestId) activeRequest = undefined;
      });
  });
  port.onDisconnect.addListener(() => activeRequest?.controller.abort());
});

function postPortEvent(port: chrome.runtime.Port, event: LlmStreamEvent): void {
  try {
    port.postMessage(event);
  } catch {
    // A disconnected content script already cancels the associated request.
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    handleMessage(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        sendResponse({ ok: false, error: message });
      });
    return true;
  },
);

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case "GET_HIGHLIGHTS_FOR_URL":
      return getHighlightsForUrl(message.urlKey);

    case "GET_VOCABULARY_FOR_URL":
      return getVocabularyForUrl(message.urlKey);

    case "GET_FOOTPRINT":
      return getFootprintForSourceUrl(message.sourceUrl);

    case "ADD_FOOTPRINT":
      return ensureFootprintRecord(message.sourceUrl, message.sourceTitle);

    case "SAVE_HIGHLIGHT":
      await Promise.all([
        putInStore("highlights", message.record),
        ensureFootprintRecord(message.record.sourceUrl, message.record.sourceTitle),
      ]);
      return message.record;

    case "UPDATE_HIGHLIGHT_STATUS":
      return updateHighlightStatus(message.id, message.status);

    case "UPDATE_HIGHLIGHT_COLOR":
      return updateHighlightColor(message.id, message.color);

    case "UPDATE_HIGHLIGHT_NOTE":
      return updateHighlightNote(message.id, message.note);

    case "UPDATE_HIGHLIGHT_STATUSES":
      return updateHighlightStatuses(message.updates);

    case "DELETE_HIGHLIGHT":
      await deleteFromStore("highlights", message.id);
      return { id: message.id };

    case "SAVE_VOCABULARY":
      message.record = normalizeVocabularyReview(message.record);
      await Promise.all([
        putInStore("vocabulary", message.record),
        ensureFootprintRecord(message.record.sourceUrl, message.record.sourceTitle),
      ]);
      await refreshReviewBadge();
      return message.record;

    case "SET_FOOTPRINT_STAR":
      return updateFootprintStar(message.urlKey, message.starred);

    case "ARCHIVE_FOOTPRINT":
      return archiveFootprint(message.urlKey);

    case "DELETE_VOCABULARY":
      await deleteVocabulary(message.id);
      await refreshReviewBadge();
      return { id: message.id };

    case "GET_REVIEW_QUEUE":
      return getReviewQueue(message.now, message.limit);

    case "GET_REVIEW_STATUS": {
      const dueCount = await countDueVocabulary(message.now);
      const next = await getNextVocabularyReview();
      return { dueCount, nextReviewAt: next?.nextReviewAt };
    }

    case "QUERY_HIGHLIGHTS":
      return queryHighlights(message.query);

    case "QUERY_VOCABULARY":
      return queryVocabulary(message.query);

    case "QUERY_FOOTPRINTS":
      return queryFootprints(message.query);

    case "SUBMIT_VOCABULARY_REVIEW": {
      const updated = await submitVocabularyReview(
        message.id,
        message.rating,
        message.reviewedAt,
      );
      await refreshReviewBadge();
      return updated;
    }

    case "EXPLAIN_SELECTION":
      return explainSelection(message);

    case "GET_PRONUNCIATION":
      return getPronunciation(message.word, message.language);

    case "GET_SETTINGS":
      return getSettings();

    case "GET_OPTIONS_OVERVIEW": {
      const [settings, counts] = await Promise.all([
        getSettings(),
        getOptionsDataCounts(),
      ]);
      return { settings, counts };
    }

    case "SAVE_SETTINGS":
      await saveSettings(message.settings);
      return message.settings;

    case "TEST_LLM_CONNECTION":
      await testLlmConnection(message.settings);
      return { connected: true };

    case "OPEN_SETTINGS_PAGE":
      await chrome.tabs.create({
        url: chrome.runtime.getURL("options.html#settings"),
      });
      return { opened: true };

    case "LIST_ALL_DATA": {
      const [highlights, vocabulary, footprints, settings] =
        await Promise.all([
          getAllFromStore<HighlightRecord>("highlights"),
          getAllFromStore<VocabularyRecord>("vocabulary"),
          getAllFootprints(),
          getSettings(),
        ]);
      return {
        footprints: buildFootprintList(highlights, vocabulary, footprints),
        highlights,
        vocabulary,
        settings,
      };
    }

    case "IMPORT_SNAPSHOT":
      await importSnapshot(message.snapshot);
      return { imported: true };
  }
}

async function updateHighlightStatus(
  id: string,
  status: HighlightStatus,
): Promise<HighlightRecord | undefined> {
  const record = await getFromStore<HighlightRecord>("highlights", id);
  if (!record) return undefined;

  const next = { ...record, status, updatedAt: new Date().toISOString() };
  await putInStore("highlights", next);
  return next;
}

async function updateHighlightColor(
  id: string,
  color: HighlightRecord["color"],
): Promise<HighlightRecord | undefined> {
  const record = await getFromStore<HighlightRecord>("highlights", id);
  if (!record) return undefined;

  const next = { ...record, color, updatedAt: new Date().toISOString() };
  await putInStore("highlights", next);
  return next;
}

async function updateHighlightNote(
  id: string,
  note: string,
): Promise<HighlightRecord | undefined> {
  const record = await getFromStore<HighlightRecord>("highlights", id);
  if (!record) return undefined;
  const next = {
    ...record,
    note: note.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  await putInStore("highlights", next);
  return next;
}

async function updateFootprintStar(
  urlKey: string,
  starred: boolean,
): Promise<FootprintRecord | undefined> {
  const record = await ensureFootprintState(urlKey);
  if (!record) return undefined;

  const next = {
    ...record,
    starred,
    updatedAt: new Date().toISOString(),
  };
  await putInStore("footprints", next);
  return next;
}

async function archiveFootprint(
  urlKey: string,
): Promise<FootprintRecord | undefined> {
  const record = await ensureFootprintState(urlKey);
  if (!record) return undefined;

  const archivedAt = new Date().toISOString();
  const next = {
    ...record,
    archivedAt,
    updatedAt: archivedAt,
  };
  await putInStore("footprints", next);
  return next;
}

async function explainSelection(
  input: Extract<RuntimeMessage, { type: "EXPLAIN_SELECTION" }>,
  stream?: { signal: AbortSignal; onChunk: (content: string) => void },
): Promise<SelectionLookupResult> {
  const settings = await getSettings();
  const llm = getEffectiveLlmConfig(settings.llm);
  const modelIdentity = `${llm.provider}:${llm.model}`;
  const targetLanguage = getTargetLanguageName(settings);
  const promptTemplate = getPromptTemplateForSelectionKind(
    settings.llm,
    input.selectionKind,
  );
  const urlKey = safeNormalizeUrlKey(input.sourceUrl);
  const { cacheKey, contextHash } = await createLookupCacheKey({
    selectedText: input.selectedText,
    context: input.context,
    sourceKey: urlKey,
    model: modelIdentity,
    selectionKind: input.selectionKind,
    promptTemplate,
    targetLanguage,
  });

  const cached = await getVocabularyByCacheKey(cacheKey);
  if (cached && !input.forceRefresh) {
    const sanitizedResult = stripOuterCodeFence(cached.translation ?? "");
    const currentRecord: VocabularyRecord = {
      ...cached,
      urlKey,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      anchor: input.anchor ?? cached.anchor,
      translation: sanitizedResult,
      updatedAt: new Date().toISOString(),
    };
    await Promise.all([
      putInStore("vocabulary", currentRecord),
      ensureFootprintRecord(currentRecord.sourceUrl, currentRecord.sourceTitle),
    ]);
    return vocabularyToLookupResult(currentRecord);
  }

  validateLlmConfiguration(settings, input.selectionKind);

  const result = await callOpenAiCompatibleApi({
    provider: llm.provider,
    baseUrl: llm.baseUrl,
    apiKey: llm.apiKey,
    model: llm.model,
    temperature: settings.llm.temperature,
    timeoutMs: settings.llm.timeoutMs,
    promptTemplate,
    targetLanguage,
    selectedText: input.selectedText,
    context: input.context,
    signal: stream?.signal,
    onChunk: stream?.onChunk,
  });

  const now = new Date().toISOString();
  const record: VocabularyRecord = normalizeVocabularyReview({
    ...cached,
    id: cached?.id ?? crypto.randomUUID(),
    selectionKind: input.selectionKind,
    word: input.selectedText,
    normalizedWord: input.selectedText.trim().toLowerCase(),
    urlKey,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    contextSentence: input.context,
    anchor: input.anchor,
    translation: result,
    cacheKey,
    contextHash,
    model: modelIdentity,
    createdAt: cached?.createdAt ?? now,
    updatedAt: now,
  });

  await Promise.all([
    putInStore("vocabulary", record),
    ensureFootprintRecord(record.sourceUrl, record.sourceTitle),
  ]);
  if (record.selectionKind === "word") void enrichVocabularyPronunciation(record);
  await refreshReviewBadge();
  return vocabularyToLookupResult(record);
}

async function enrichVocabularyPronunciation(record: VocabularyRecord): Promise<void> {
  try {
    const result = await getPronunciation(record.word);
    if (!result.phonetic && !result.audioUrl && !result.audioDataUrl) return;
    const current = await getFromStore<VocabularyRecord>("vocabulary", record.id);
    if (!current) return;
    await putInStore("vocabulary", {
      ...current,
      phonetic: result.phonetic ?? current.phonetic,
      audioProvider: result.provider,
      audioUrl: result.audioUrl ?? current.audioUrl,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Pronunciation enrichment must never fail a successful word lookup.
  }
}

async function getVocabularyForUrl(
  urlKey: string,
): Promise<VocabularyRecord[]> {
  const vocabulary = await getVocabularyRecordsForUrl(urlKey);
  return vocabulary.filter((record) => record.selectionKind !== "text");
}

async function getFootprintForSourceUrl(
  sourceUrl: string,
): Promise<FootprintRecord | undefined> {
  const urlKey = safeNormalizeUrlKey(sourceUrl);
  if (!urlKey) return undefined;
  const existing = await getFootprint(urlKey);
  if (existing) return existing;

  const [highlights, vocabulary] = await Promise.all([
    getHighlightsForUrl(urlKey),
    getVocabularyForUrl(urlKey),
  ]);
  if (highlights.length === 0 && vocabulary.length === 0) return undefined;

  const sourceTitle =
    highlights[0]?.sourceTitle || vocabulary[0]?.sourceTitle || sourceUrl;
  return ensureFootprintRecord(sourceUrl, sourceTitle);
}

async function deleteVocabulary(id: string): Promise<{ id: string }> {
  await deleteFromStore("vocabulary", id);
  return { id };
}

function vocabularyToLookupResult(record: VocabularyRecord): SelectionLookupResult {
  return {
    id: record.id,
    selectionKind: record.selectionKind ?? "word",
    selectedText: record.word,
    context: record.contextSentence,
    sourceUrl: record.sourceUrl,
    sourceTitle: record.sourceTitle,
    anchor: record.anchor,
    result: record.translation ?? "",
    createdAt: record.createdAt,
  };
}

function buildFootprintList(
  highlights: HighlightRecord[],
  vocabulary: VocabularyRecord[],
  footprints: FootprintRecord[],
): FootprintListItem[] {
  const footprintsByKey = new Map(
    footprints.map((record) => [record.urlKey, record]),
  );
  const activityByKey = new Map<string, FootprintListItem>(
    footprints.map((record) => [
      record.urlKey,
      createFootprintListItem(record.urlKey, record),
    ]),
  );

  for (const highlight of highlights) {
    const urlKey = highlight.urlKey || safeNormalizeUrlKey(highlight.sourceUrl);
    if (!urlKey) continue;
    const existing = activityByKey.get(urlKey);
    activityByKey.set(urlKey, {
      ...(existing ?? createFootprintListItem(urlKey, footprintsByKey.get(urlKey))),
      sourceUrl: urlKey,
      sourceTitle:
        highlight.sourceTitle ||
        existing?.sourceTitle ||
        footprintsByKey.get(urlKey)?.sourceTitle ||
        urlKey,
      siteName:
        existing?.siteName ||
        footprintsByKey.get(urlKey)?.siteName ||
        safeGetHostname(urlKey),
      browsedAt: getLatestIsoTimestamp(existing?.browsedAt, highlight.createdAt),
      highlightCount: (existing?.highlightCount ?? 0) + 1,
      lookupCount: existing?.lookupCount ?? 0,
    });
  }

  for (const item of vocabulary) {
    const urlKey = item.urlKey;
    if (!urlKey) continue;
    const existing = activityByKey.get(urlKey);
    activityByKey.set(urlKey, {
      ...(existing ?? createFootprintListItem(urlKey, footprintsByKey.get(urlKey))),
      sourceUrl: urlKey,
      sourceTitle:
        item.sourceTitle ||
        existing?.sourceTitle ||
        footprintsByKey.get(urlKey)?.sourceTitle ||
        urlKey,
      siteName:
        existing?.siteName ||
        footprintsByKey.get(urlKey)?.siteName ||
        safeGetHostname(urlKey),
      browsedAt: getLatestIsoTimestamp(
        existing?.browsedAt,
        item.createdAt,
      ),
      highlightCount: existing?.highlightCount ?? 0,
      lookupCount: (existing?.lookupCount ?? 0) + 1,
    });
  }

  return [...activityByKey.values()]
    .filter((record) => !record.archivedAt)
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
}

function createFootprintListItem(
  urlKey: string,
  footprint?: FootprintRecord,
): FootprintListItem {
  const createdAt = footprint?.createdAt ?? new Date(0).toISOString();
  return {
    urlKey,
    sourceUrl: footprint?.sourceUrl ?? urlKey,
    sourceTitle: footprint?.sourceTitle ?? urlKey,
    siteName: footprint?.siteName ?? safeGetHostname(urlKey),
    starred: footprint?.starred ?? false,
    archivedAt: footprint?.archivedAt,
    createdAt,
    updatedAt: footprint?.updatedAt ?? createdAt,
    browsedAt: createdAt,
    highlightCount: 0,
    lookupCount: 0,
  };
}

function getLatestIsoTimestamp(
  left: string | undefined,
  right: string | undefined,
): string {
  if (!left) return right ?? new Date(0).toISOString();
  if (!right) return left;
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function getTargetLanguageName(settings: AppSettings): string {
  return (
    TARGET_LANGUAGE_NAMES[settings.ui.language] ?? TARGET_LANGUAGE_NAMES.en
  );
}

function validateRequiredLlmConfiguration(settings: AppSettings) {
  const llm = getEffectiveLlmConfig(settings.llm);
  const missing: string[] = [];
  if (!llm.baseUrl.trim()) missing.push("base URL");
  if (!llm.apiKey.trim()) missing.push("API key");
  if (!llm.model.trim()) missing.push("model");
  if (missing.length) {
    throw new Error(`${llm.provider} LLM configuration is missing: ${missing.join(", ")}.`);
  }
  return llm;
}

function validateLlmConfiguration(
  settings: AppSettings,
  selectionKind: "word" | "text",
): void {
  validateRequiredLlmConfiguration(settings);
  const promptTemplate = getPromptTemplateForSelectionKind(
    settings.llm,
    selectionKind,
  );
  const missingPromptVariables = ["{{selection}}", "{{context}}"]
    .filter((variable) => !promptTemplate.includes(variable));
  if (missingPromptVariables.length) {
    throw new Error(
      `LLM prompt template is missing required variables: ${missingPromptVariables.join(", ")}.`,
    );
  }
}

async function testLlmConnection(settings: AppSettings): Promise<void> {
  const llm = validateRequiredLlmConfiguration(settings);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), settings.llm.timeoutMs);
  const baseUrl = llm.baseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [{ role: "user", content: "Reply with OK." }],
        ...getReasoningDisabledParams(llm.provider, llm.model),
        stream: false,
      }),
    });

    if (!response.ok) throw await createLlmRequestError(response);
    await response.body?.cancel();
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`LLM connection test timed out after ${settings.llm.timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeNormalizeUrlKey(sourceUrl: string): string {
  try {
    return normalizeUrlKey(sourceUrl);
  } catch {
    return "";
  }
}

function safeGetHostname(sourceUrl: string): string {
  try {
    return getHostname(sourceUrl);
  } catch {
    return "";
  }
}

async function ensureFootprintRecord(
  sourceUrl: string,
  sourceTitle: string,
): Promise<FootprintRecord | undefined> {
  const urlKey = safeNormalizeUrlKey(sourceUrl);
  if (!urlKey) return undefined;

  const existing = await getFootprint(urlKey);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: FootprintRecord = {
    urlKey,
    sourceUrl: urlKey,
    sourceTitle: sourceTitle || urlKey,
    siteName: safeGetHostname(urlKey),
    starred: false,
    createdAt: now,
    updatedAt: now,
  };
  await putInStore("footprints", record);
  return record;
}

async function ensureFootprintState(
  urlKey: string,
): Promise<FootprintRecord | undefined> {
  const existing = await getFootprint(urlKey);
  if (existing) return existing;
  return ensureFootprintRecord(urlKey, urlKey);
}

async function callOpenAiCompatibleApi(input: {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  promptTemplate: string;
  targetLanguage: string;
  selectedText: string;
  context: string;
  signal?: AbortSignal;
  onChunk?: (content: string) => void;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const prompt = renderPromptTemplate(input.promptTemplate, {
    selection: input.selectedText,
    context: input.context,
  });
  const requestBody: OpenAiCompatibleChatRequestBody = {
    model: input.model,
    temperature: input.temperature,
    messages: [
      {
        role: "system",
        content: `Follow the user's prompt template exactly. Respond in ${input.targetLanguage}. Return Markdown.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    ...getReasoningDisabledParams(input.provider, input.model),
    stream: true,
  };

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw await createLlmRequestError(response);

    const contentType = response.headers.get("content-type") ?? "";
    let content = "";
    if (!contentType.includes("text/event-stream")) {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      content = json.choices?.[0]?.message?.content ?? "";
      if (content) input.onChunk?.(content);
    } else {
      if (!response.body) throw new Error("LLM streaming response had no body.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new OpenAiSseParser();
      while (true) {
        const { value, done } = await reader.read();
        let parsed: { content: string[]; done: boolean };
        if (done) {
          const flushed = decoder.decode();
          const pushed = flushed
            ? parser.push(flushed)
            : { content: [], done: false };
          const finished = parser.finish();
          parsed = {
            content: [...pushed.content, ...finished.content],
            done: pushed.done || finished.done,
          };
        } else {
          parsed = parser.push(decoder.decode(value, { stream: true }));
        }
        for (const chunk of parsed.content) {
          content += chunk;
          input.onChunk?.(chunk);
        }
        if (done || parsed.done) break;
      }
    }

    content = content.trim();
    if (!content) throw new Error("LLM response did not include content.");
    return stripOuterCodeFence(content);
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function createLlmRequestError(response: Response): Promise<Error> {
  const responseText = await response.text();
  let detail = responseText;
  try {
    const parsed = JSON.parse(responseText) as {
      error?: { message?: string } | string;
      message?: string;
    };
    detail =
      (typeof parsed.error === "object" ? parsed.error?.message : parsed.error) ??
      parsed.message ??
      responseText;
  } catch {
    // Some OpenAI-compatible providers return plain text or HTML errors.
  }
  const normalizedDetail = detail.replace(/\s+/g, " ").trim().slice(0, 500);
  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  return new Error(
    `LLM request failed (${status})${normalizedDetail ? `: ${normalizedDetail}` : "."}`,
  );
}

async function refreshReviewBadge(): Promise<void> {
  const dueCount = await countDueVocabulary(new Date().toISOString()).catch(() => 0);
  await chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
  await chrome.action.setBadgeText({ text: dueCount ? (dueCount > 99 ? "99+" : String(dueCount)) : "" });
}

type OpenAiCompatibleChatRequestBody = {
  model: string;
  temperature: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
} & Record<string, unknown>;

function getReasoningDisabledParams(
  provider: LlmProvider,
  model: string,
): Record<string, unknown> {
  if (provider === "openrouter" && canDisableOpenRouterReasoning(model)) {
    return { reasoning: { effort: "none", exclude: true } };
  }

  if (provider === "gemini" && canDisableGeminiThinking(model)) {
    return { reasoning_effort: "none" };
  }

  if (provider === "aliyun" && canDisableAliyunThinking(model)) {
    return { enable_thinking: false };
  }

  if (provider === "zhipu" && canDisableZhipuThinking(model)) {
    return { thinking: { type: "disabled" } };
  }

  if (provider === "deepseek" && canDisableDeepSeekThinking(model)) {
    return { thinking: { type: "disabled" } };
  }

  return {};
}

function canDisableOpenRouterReasoning(model: string): boolean {
  const normalized = model.toLowerCase();
  return !(
    normalized.includes("gemini-3") || normalized.includes("gemini-2.5-pro")
  );
}

function canDisableGeminiThinking(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes("gemini-2.5") && !normalized.includes("pro");
}

function canDisableAliyunThinking(model: string): boolean {
  const normalized = model.toLowerCase();
  return !(
    normalized.includes("thinking") ||
    normalized.includes("deepseek-r1") ||
    normalized.includes("qwq") ||
    normalized.startsWith("minimax-m")
  );
}

function canDisableZhipuThinking(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized.startsWith("glm-4.5") ||
    normalized.startsWith("glm-4.6") ||
    normalized.startsWith("glm-4.7") ||
    normalized.startsWith("glm-5")
  );
}

function canDisableDeepSeekThinking(model: string): boolean {
  const normalized = model.toLowerCase();
  return (
    normalized.includes("deepseek-v4-pro") ||
    normalized.includes("deepseek-v4-flash")
  );
}

function renderPromptTemplate(
  template: string,
  values: { selection: string; context: string },
): string {
  return template
    .replaceAll("{{selection}}", values.selection)
    .replaceAll("{{context}}", values.context);
}

async function getPronunciation(
  word: string,
  requestedLanguage?: string,
): Promise<PronunciationResult> {
  const requestedSpeechLanguage = requestedLanguage === "en"
    ? "en-US"
    : (requestedLanguage || "en-US");
  const containsCjkScript = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u
    .test(word);
  if (containsCjkScript) {
    return {
      provider: "speech-synthesis",
      language: detectSpeechLanguage(word, requestedSpeechLanguage),
    };
  }
  const dictionaryLanguage = "en-US";
  const settings = await getSettings();
  const apiKey = settings.pronunciation.merriamWebsterApiKey.trim();

  if (apiKey) {
    const result = await getCachedPronunciation(word, dictionaryLanguage, "merriam-webster") ??
      await getMerriamWebsterAudio(word, apiKey).catch(
      () => undefined,
    );
    if (result) return cachePronunciation(word, result);
  }

  const freeDictionary =
    await getCachedPronunciation(word, dictionaryLanguage, "free-dictionary") ??
    await getFreeDictionaryAudio(word).catch(() => undefined);
  return freeDictionary ? cachePronunciation(word, freeDictionary) : {
    provider: "speech-synthesis",
    language: requestedSpeechLanguage,
  };
}

async function getMerriamWebsterAudio(
  word: string,
  apiKey: string,
): Promise<PronunciationResult | undefined> {
  const response = await fetch(
    `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(apiKey)}`,
  );
  if (!response.ok) return undefined;

  const data = (await response.json()) as Array<{
    hwi?: { prs?: Array<{ mw?: string; sound?: { audio?: string } }> };
  }>;
  const pronunciation = data.find((entry) =>
    entry.hwi?.prs?.some((pronunciation) => pronunciation.sound?.audio),
  )?.hwi?.prs?.find((item) => item.sound?.audio);
  const audio = pronunciation?.sound?.audio;
  if (!audio) return undefined;

  const subdirectory = getMerriamWebsterAudioSubdirectory(audio);
  return {
    provider: "merriam-webster",
    audioUrl: `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`,
    language: "en-US",
    phonetic: pronunciation?.mw,
  };
}

function getMerriamWebsterAudioSubdirectory(audio: string): string {
  if (audio.startsWith("bix")) return "bix";
  if (audio.startsWith("gg")) return "gg";
  const first = audio[0]?.toLowerCase();
  return first && /^[a-z]$/.test(first) ? first : "number";
}

async function getFreeDictionaryAudio(
  word: string,
): Promise<PronunciationResult | undefined> {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
  );
  if (!response.ok) return undefined;

  const data = (await response.json()) as Array<{
    phonetic?: string;
    phonetics?: Array<{ text?: string; audio?: string }>;
  }>;
  const audioUrl = data
    .flatMap((entry) => entry.phonetics ?? [])
    .map((phonetic) => phonetic.audio)
    .find((audio): audio is string => Boolean(audio));

  if (!audioUrl) return undefined;
  const phonetic = data.flatMap((entry) => entry.phonetics ?? [])
    .find((item) => item.text)?.text ?? data.find((entry) => entry.phonetic)?.phonetic;
  return { provider: "free-dictionary", audioUrl, phonetic, language: "en-US" };
}

const MAX_AUDIO_CACHE_BYTES = 512 * 1024;

function getAudioCacheKey(
  word: string,
  language: string,
  provider: "merriam-webster" | "free-dictionary",
): string {
  return `${language}:${normalizeWord(word)}:${provider}`;
}

async function getCachedPronunciation(
  word: string,
  language: string,
  provider: "merriam-webster" | "free-dictionary",
): Promise<PronunciationResult | undefined> {
  const key = getAudioCacheKey(word, language, provider);
  const cached = await getAudioCache(key);
  if (!cached) return undefined;
  try {
    const audioDataUrl = cached.audioBlob
      ? await blobToDataUrl(cached.audioBlob, cached.mimeType)
      : undefined;
    await saveAudioCache({ ...cached, lastAccessedAt: new Date().toISOString() });
    return {
      provider,
      language: cached.language,
      audioDataUrl,
      audioUrl: cached.audioUrl,
      phonetic: cached.phonetic,
    };
  } catch {
    await deleteAudioCache(key);
    return undefined;
  }
}

async function cachePronunciation(
  word: string,
  result: PronunciationResult,
): Promise<PronunciationResult> {
  if (result.provider === "speech-synthesis" || !result.audioUrl) return result;
  const now = new Date().toISOString();
  let audioBlob: Blob | undefined;
  let audioDataUrl: string | undefined;
  let mimeType: string | undefined;
  try {
    const response = await fetch(result.audioUrl);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size <= MAX_AUDIO_CACHE_BYTES) {
        audioBlob = blob;
        mimeType = blob.type || "audio/mpeg";
        audioDataUrl = await blobToDataUrl(blob, mimeType);
      }
    }
  } catch {
    // The original remote URL remains a valid pronunciation fallback.
  }
  await saveAudioCache({
    key: getAudioCacheKey(word, result.language, result.provider),
    language: result.language,
    normalizedWord: normalizeWord(word),
    provider: result.provider,
    mimeType,
    audioBlob,
    audioUrl: result.audioUrl,
    phonetic: result.phonetic,
    createdAt: now,
    lastAccessedAt: now,
  });
  return { ...result, audioDataUrl };
}

async function blobToDataUrl(blob: Blob, mimeType?: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mimeType || blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}
