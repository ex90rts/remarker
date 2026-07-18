import { createLookupCacheKey } from "../shared/cache-key";
import type { RuntimeMessage, PronunciationResult } from "../shared/messages";
import { stripOuterCodeFence } from "../shared/markdown";
import { getHostname, normalizeUrlKey } from "../shared/url";
import {
  deleteFromStore,
  getAllFromStore,
  getAllFootprints,
  getFootprint,
  getHighlightsForUrl,
  getSettings,
  getVocabularyByCacheKey,
  importSnapshot,
  putInStore,
  saveSettings,
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
import { getEffectiveLlmConfig } from "../shared/types";

const TARGET_LANGUAGE_NAMES: Record<AppSettings["ui"]["language"], string> = {
  "zh-CN": "Simplified Chinese",
  "zh-TW": "Traditional Chinese",
  en: "English",
  es: "Spanish",
};

chrome.runtime.onInstalled.addListener(async () => {
  const cache = await chrome.storage.local.get([
    "globalEnabled",
    "disabledSites",
    "schemaVersion",
  ]);
  await chrome.storage.local.set({
    globalEnabled: cache.globalEnabled ?? true,
    disabledSites: cache.disabledSites ?? [],
    schemaVersion: cache.schemaVersion ?? 1,
  });
});

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

    case "DELETE_HIGHLIGHT":
      await deleteFromStore("highlights", message.id);
      return { id: message.id };

    case "SAVE_VOCABULARY":
      await Promise.all([
        putInStore("vocabulary", message.record),
        ensureFootprintRecord(message.record.sourceUrl, message.record.sourceTitle),
      ]);
      return message.record;

    case "SET_FOOTPRINT_STAR":
      return updateFootprintStar(message.urlKey, message.starred);

    case "ARCHIVE_FOOTPRINT":
      return archiveFootprint(message.urlKey);

    case "DELETE_VOCABULARY":
      return deleteVocabulary(message.id);

    case "EXPLAIN_SELECTION":
      return explainSelection(message);

    case "GET_PRONUNCIATION":
      return getPronunciation(message.word);

    case "GET_SETTINGS":
      return getSettings();

    case "SAVE_SETTINGS":
      await saveSettings(message.settings);
      return message.settings;

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
  const highlights = await getAllFromStore<HighlightRecord>("highlights");
  const record = highlights.find((item) => item.id === id);
  if (!record) return undefined;

  const next = { ...record, status, updatedAt: new Date().toISOString() };
  await putInStore("highlights", next);
  return next;
}

async function updateHighlightColor(
  id: string,
  color: HighlightRecord["color"],
): Promise<HighlightRecord | undefined> {
  const highlights = await getAllFromStore<HighlightRecord>("highlights");
  const record = highlights.find((item) => item.id === id);
  if (!record) return undefined;

  const next = { ...record, color, updatedAt: new Date().toISOString() };
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
): Promise<SelectionLookupResult> {
  const settings = await getSettings();
  const llm = getEffectiveLlmConfig(settings.llm);
  const modelIdentity = `${llm.provider}:${llm.model}`;
  const targetLanguage = getTargetLanguageName(settings);
  const urlKey = safeNormalizeUrlKey(input.sourceUrl);
  const { cacheKey, contextHash } = await createLookupCacheKey({
    selectedText: input.selectedText,
    context: input.context,
    sourceKey: urlKey,
    model: modelIdentity,
    selectionKind: input.selectionKind,
    promptTemplate: settings.llm.promptTemplate,
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

  if (!isLlmConfigured(settings)) {
    throw new Error("LLM configuration is incomplete.");
  }

  const result = await callOpenAiCompatibleApi({
    provider: llm.provider,
    baseUrl: llm.baseUrl,
    apiKey: llm.apiKey,
    model: llm.model,
    temperature: settings.llm.temperature,
    timeoutMs: settings.llm.timeoutMs,
    promptTemplate: settings.llm.promptTemplate,
    targetLanguage,
    selectionKind: input.selectionKind,
    selectedText: input.selectedText,
    context: input.context,
  });

  const now = new Date().toISOString();
  const record: VocabularyRecord = {
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
  };

  await Promise.all([
    putInStore("vocabulary", record),
    ensureFootprintRecord(record.sourceUrl, record.sourceTitle),
  ]);
  return vocabularyToLookupResult(record);
}

async function getVocabularyForUrl(
  urlKey: string,
): Promise<VocabularyRecord[]> {
  const vocabulary = await getAllFromStore<VocabularyRecord>("vocabulary");
  return vocabulary.filter(
    (record) => record.urlKey === urlKey && record.selectionKind !== "text",
  );
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

function isLlmConfigured(settings: AppSettings): boolean {
  const llm = getEffectiveLlmConfig(settings.llm);
  return Boolean(llm.baseUrl.trim() && llm.apiKey.trim() && llm.model.trim());
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
  selectionKind: "word" | "text";
  selectedText: string;
  context: string;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), input.timeoutMs);
  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const prompt = renderPromptTemplate(input.promptTemplate, {
    task: buildTask(input.selectionKind, input.targetLanguage),
    selection: input.selectedText,
    context: input.context,
  });
  const requestBody: OpenAiCompatibleChatRequestBody = {
    model: input.model,
    temperature: input.temperature,
    messages: [
      {
        role: "system",
        content: "Follow the user's prompt template exactly. Return Markdown.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    ...getReasoningDisabledParams(input.provider, input.model),
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

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("LLM response did not include content.");
    return stripOuterCodeFence(content);
  } finally {
    clearTimeout(timeoutId);
  }
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
  values: { task: string; selection: string; context: string },
): string {
  return template
    .replaceAll("{{task}}", values.task)
    .replaceAll("{{selection}}", values.selection)
    .replaceAll("{{context}}", values.context);
}

function buildTask(
  selectionKind: "word" | "text",
  targetLanguage: string,
): string {
  const languageInstruction = `Infer the source language for translation or word lookup from the context; default to English when uncertain. The target language is ${targetLanguage}.`;
  const taskInstruction =
    selectionKind === "word"
      ? "Explain the selected word in context."
      : "Translate the selected text according to the provided context.";
  return `${languageInstruction} ${taskInstruction}`;
}

async function getPronunciation(word: string): Promise<PronunciationResult> {
  const settings = await getSettings();
  const apiKey = settings.pronunciation.merriamWebsterApiKey.trim();

  if (apiKey) {
    const result = await getMerriamWebsterAudio(word, apiKey).catch(
      () => undefined,
    );
    if (result) return result;
  }

  const freeDictionary = await getFreeDictionaryAudio(word).catch(
    () => undefined,
  );
  return freeDictionary ?? { provider: "speech-synthesis" };
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
    hwi?: { prs?: Array<{ sound?: { audio?: string } }> };
  }>;
  const audio = data.find((entry) =>
    entry.hwi?.prs?.some((pronunciation) => pronunciation.sound?.audio),
  )?.hwi?.prs?.[0]?.sound?.audio;
  if (!audio) return undefined;

  const subdirectory = getMerriamWebsterAudioSubdirectory(audio);
  return {
    provider: "merriam-webster",
    audioUrl: `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`,
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
    phonetics?: Array<{ audio?: string }>;
  }>;
  const audioUrl = data
    .flatMap((entry) => entry.phonetics ?? [])
    .map((phonetic) => phonetic.audio)
    .find((audio): audio is string => Boolean(audio));

  if (!audioUrl) return undefined;
  return { provider: "free-dictionary", audioUrl };
}
