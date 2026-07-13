import { createExplanationCacheKey } from "../shared/cache-key";
import type { RuntimeMessage, PronunciationResult } from "../shared/messages";
import { normalizeUrlKey } from "../shared/url";
import {
  clearStore,
  deleteFromStore,
  getAllFromStore,
  getExplanationByCacheKey,
  getHighlightsForUrl,
  getSettings,
  importSnapshot,
  putInStore,
  saveSettings,
} from "../shared/repositories/db";
import type {
  AppSettings,
  ExplanationRecord,
  HighlightRecord,
  HighlightStatus,
  LlmProvider,
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

    case "GET_WORD_EXPLANATIONS_FOR_URL":
      return getWordExplanationsForUrl(message.urlKey);

    case "GET_VOCABULARY_FOR_URL":
      return getVocabularyForUrl(message.urlKey);

    case "SAVE_HIGHLIGHT":
      await putInStore("highlights", message.record);
      return message.record;

    case "UPDATE_HIGHLIGHT_STATUS":
      return updateHighlightStatus(message.id, message.status);

    case "UPDATE_HIGHLIGHT_COLOR":
      return updateHighlightColor(message.id, message.color);

    case "DELETE_HIGHLIGHT":
      await deleteFromStore("highlights", message.id);
      return { id: message.id };

    case "SAVE_VOCABULARY":
      await putInStore("vocabulary", message.record);
      return message.record;

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
      const [highlights, vocabulary, explanations, settings] =
        await Promise.all([
          getAllFromStore<HighlightRecord>("highlights"),
          getAllFromStore<VocabularyRecord>("vocabulary"),
          getAllFromStore<ExplanationRecord>("explanations"),
          getSettings(),
        ]);
      const mergedVocabulary = await mergeVocabularyWithLegacyExplanations(
        vocabulary,
        explanations,
      );
      return { highlights, vocabulary: mergedVocabulary, settings };
    }

    case "IMPORT_SNAPSHOT":
      await importSnapshot(message.snapshot);
      return { imported: true };

    case "DELETE_EXPLANATION":
      await deleteFromStore("explanations", message.id);
      return { id: message.id };

    case "CLEAR_EXPLANATIONS":
      await clearStore("explanations");
      return { cleared: true };
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

async function explainSelection(
  input: Extract<RuntimeMessage, { type: "EXPLAIN_SELECTION" }>,
): Promise<ExplanationRecord> {
  const settings = await getSettings();
  const llm = getEffectiveLlmConfig(settings.llm);
  const modelIdentity = `${llm.provider}:${llm.model}`;
  const targetLanguage = getTargetLanguageName(settings);
  const { cacheKey, contextHash } = await createExplanationCacheKey({
    selectedText: input.selectedText,
    context: input.context,
    model: modelIdentity,
    selectionKind: input.selectionKind,
    promptTemplate: settings.llm.promptTemplate,
    targetLanguage,
  });

  const cached = await getExplanationByCacheKey(cacheKey);
  if (cached && !input.forceRefresh) {
    const currentRecord = {
      ...cached,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      anchor: input.anchor ?? cached.anchor,
    };
    await putInStore("explanations", currentRecord);
    if (input.selectionKind === "word")
      await upsertVocabularyFromExplanation(currentRecord);
    return currentRecord;
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

  const record: ExplanationRecord = {
    id: cached?.id ?? crypto.randomUUID(),
    cacheKey,
    selectionKind: input.selectionKind,
    selectedText: input.selectedText,
    context: input.context,
    contextHash,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    anchor: input.anchor,
    model: modelIdentity,
    result,
    createdAt: new Date().toISOString(),
  };

  await putInStore("explanations", record);
  if (input.selectionKind === "word")
    await upsertVocabularyFromExplanation(record);
  return record;
}

async function getWordExplanationsForUrl(
  urlKey: string,
): Promise<ExplanationRecord[]> {
  const records = await getAllFromStore<ExplanationRecord>("explanations");
  return records.filter((record) => {
    if (safeNormalizeUrlKey(record.sourceUrl) !== urlKey) return false;
    if (record.selectionKind) return record.selectionKind === "word";
    return isWordLikeSelection(record.selectedText);
  });
}

async function getVocabularyForUrl(
  urlKey: string,
): Promise<VocabularyRecord[]> {
  const [vocabulary, explanations] = await Promise.all([
    getAllFromStore<VocabularyRecord>("vocabulary"),
    getAllFromStore<ExplanationRecord>("explanations"),
  ]);
  const mergedVocabulary = await mergeVocabularyWithLegacyExplanations(
    vocabulary,
    explanations,
  );
  return mergedVocabulary.filter(
    (record) => safeNormalizeUrlKey(record.sourceUrl) === urlKey,
  );
}

async function deleteVocabulary(id: string): Promise<{ id: string }> {
  const [vocabulary, explanations] = await Promise.all([
    getAllFromStore<VocabularyRecord>("vocabulary"),
    getAllFromStore<ExplanationRecord>("explanations"),
  ]);
  const record = vocabulary.find((item) => item.id === id);
  const mergeKey = record ? getVocabularyMergeKey(record) : undefined;

  await deleteFromStore("vocabulary", id);

  for (const explanation of explanations) {
    if (
      explanation.id === id ||
      (mergeKey &&
        getVocabularyMergeKey(vocabularyFromExplanation(explanation)) ===
          mergeKey)
    ) {
      await deleteFromStore("explanations", explanation.id);
    }
  }

  return { id };
}

async function mergeVocabularyWithLegacyExplanations(
  vocabulary: VocabularyRecord[],
  explanations: ExplanationRecord[],
): Promise<VocabularyRecord[]> {
  const byKey = new Map(
    vocabulary.map((record) => [getVocabularyMergeKey(record), record]),
  );
  let changed = false;

  for (const explanation of explanations) {
    if (!isWordLikeSelection(explanation.selectedText)) continue;
    const record = vocabularyFromExplanation(explanation);
    const key = getVocabularyMergeKey(record);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, record);
      await putInStore("vocabulary", record);
      changed = true;
      continue;
    }

    if (!existing.translation && record.translation) {
      const next = {
        ...existing,
        translation: record.translation,
        updatedAt: new Date().toISOString(),
      };
      byKey.set(key, next);
      await putInStore("vocabulary", next);
      changed = true;
    }
  }

  return changed ? [...byKey.values()] : vocabulary;
}

async function upsertVocabularyFromExplanation(
  explanation: ExplanationRecord,
): Promise<VocabularyRecord> {
  const next = vocabularyFromExplanation(explanation);
  const records = await getAllFromStore<VocabularyRecord>("vocabulary");
  const existing = records.find(
    (record) => getVocabularyMergeKey(record) === getVocabularyMergeKey(next),
  );
  const record = existing
    ? {
        ...existing,
        sourceTitle: explanation.sourceTitle,
        anchor: explanation.anchor ?? existing.anchor,
        translation: explanation.result,
        updatedAt: new Date().toISOString(),
      }
    : next;

  await putInStore("vocabulary", record);
  return record;
}

function vocabularyFromExplanation(
  explanation: ExplanationRecord,
): VocabularyRecord {
  return {
    id: explanation.id,
    word: explanation.selectedText,
    normalizedWord: explanation.selectedText.trim().toLowerCase(),
    sourceUrl: explanation.sourceUrl,
    sourceTitle: explanation.sourceTitle,
    contextSentence: explanation.context,
    anchor: explanation.anchor,
    translation: explanation.result,
    createdAt: explanation.createdAt,
    updatedAt: explanation.createdAt,
  };
}

function getVocabularyMergeKey(record: VocabularyRecord): string {
  return [
    record.normalizedWord || record.word.trim().toLowerCase(),
    safeNormalizeUrlKey(record.sourceUrl),
    record.contextSentence.trim().replace(/\s+/g, " "),
  ].join("\n");
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

function isWordLikeSelection(value: string): boolean {
  return /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(value.trim());
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
    return content;
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
