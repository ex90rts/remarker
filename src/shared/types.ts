import type { SupportedLanguage } from "./i18n";

export type HighlightStatus = "pending" | "active" | "not_found" | "ambiguous";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

export const RECORDS_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type RecordsPageSize = (typeof RECORDS_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_RECORDS_PAGE_SIZE: RecordsPageSize = 20;

export type LlmProvider =
  | "zhipu"
  | "gemini"
  | "openrouter"
  | "deepseek"
  | "aliyun"
  | "volcengine"
  | "custom";

export interface LlmProviderPreset {
  value: LlmProvider;
  label: string;
  baseUrl: string;
  model: string;
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    value: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.5-flash",
  },
  {
    value: "gemini",
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash",
  },
  {
    value: "zhipu",
    label: "智谱 AI / Z.ai",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.7-flash",
  },
  {
    value: "aliyun",
    label: "阿里百炼 / Alibaba DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-flash",
  },
  {
    value: "volcengine",
    label: "字节火山引擎 / ByteDance Volcengine",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-flash-250715",
  },
  {
    value: "custom",
    label: "Custom",
    baseUrl: "",
    model: "",
  },
];

export const DEFAULT_LLM_PROVIDER: LlmProvider = "zhipu";

export interface LlmProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type LlmProviderConfigs = Record<LlmProvider, LlmProviderConfig>;

export interface EffectiveLlmConfig extends LlmProviderConfig {
  provider: LlmProvider;
}

export interface TextAnchor {
  selectedText: string;
  prefixText: string;
  suffixText: string;
  textStart: number;
  textEnd: number;
}

export interface HighlightRecord {
  id: string;
  urlKey: string;
  sourceUrl: string;
  sourceTitle: string;
  selectedText: string;
  color: HighlightColor;
  anchor: TextAnchor;
  status: HighlightStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VocabularyRecord {
  id: string;
  word: string;
  normalizedWord: string;
  urlKey?: string;
  sourceUrl: string;
  sourceTitle: string;
  contextSentence: string;
  anchor?: TextAnchor;
  translation?: string;
  audioProvider?: string;
  audioUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  providers: LlmProviderConfigs;
  temperature: number;
  timeoutMs: number;
  promptTemplate: string;
}

export interface PronunciationConfig {
  merriamWebsterApiKey: string;
}

export interface UiPreferences {
  defaultHighlightColor: HighlightColor;
  language: SupportedLanguage;
  autoCloseLookupPanelOnCopy: boolean;
  recordsPageSize: RecordsPageSize;
}

export interface AppSettings {
  llm: LlmConfig;
  pronunciation: PronunciationConfig;
  ui: UiPreferences;
}

export interface SiteSetting {
  hostname: string;
  enabled: boolean;
  updatedAt: string;
}

export interface ExplanationRecord {
  id: string;
  cacheKey: string;
  selectionKind?: "word" | "text";
  selectedText: string;
  context: string;
  contextHash: string;
  urlKey?: string;
  sourceUrl: string;
  sourceTitle: string;
  anchor?: TextAnchor;
  model: string;
  result: string;
  createdAt: string;
}

export interface FootprintRecord {
  urlKey: string;
  sourceUrl: string;
  sourceTitle: string;
  siteName: string;
  starred: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FootprintListItem extends FootprintRecord {
  browsedAt: string;
  highlightCount: number;
  lookupCount: number;
}

export interface StartupCache {
  globalEnabled: boolean;
  disabledSites: string[];
  schemaVersion: number;
}

const DEFAULT_PROMPT_TEMPLATE_EN =
  "You are a knowledgeable, trend-savvy linguist. Below, you'll help a reader complete the following task.\n\nTask:\n{{task}}\n\nSelection:\n{{selection}}\n\nContext:\n{{context}}\n\nRequirements:\n- The language used in the response must match the target language specified in the task.\n- If the task is translation, complete the translation of the selected content based on context, then provide a context-based analysis along with high-frequency vocabulary and common phrase extraction. The returned content must follow this exact order with no extraneous content: Best Translation, Context Analysis, High-Frequency Vocabulary and Common Phrases.\n- If the task is word lookup, determine the best meaning of the selected content based on context analysis, then provide a context-based analysis along with common usage expansion. The returned content must follow this exact order with no extraneous content: Current Meaning, Context Analysis, Additional Meanings, Common Usage and Example Sentences.\n- The returned content must be in Markdown source format.";

const DEFAULT_PROMPT_TEMPLATE_ZH_CN =
  "你是一位知识丰富、熟悉流行表达的语言学专家。接下来请帮助读者完成以下任务。\n\n任务：\n{{task}}\n\n选中内容：\n{{selection}}\n\n上下文：\n{{context}}\n\n要求：\n- 回复语言必须符合任务中指定的目标语言。\n- 如果任务是翻译，请结合上下文完整翻译选中内容，然后给出基于上下文的解析，并提取高频词汇和常用短语。返回内容必须严格按以下顺序组织，不要添加无关内容：最佳翻译、上下文解析、高频词汇和常用短语。\n- 如果任务是查词，请结合上下文判断选中内容在当前语境中的最佳含义，然后给出基于上下文的解析，并补充常见用法扩展。返回内容必须严格按以下顺序组织，不要添加无关内容：当前含义、上下文解析、其他含义、常见用法和例句。\n- 返回内容必须是 Markdown 源码格式。";

function shouldUseChineseDefaultPrompt(language?: SupportedLanguage): boolean {
  return language === "zh-CN" || language === "zh-TW";
}

export function getDefaultPromptTemplate(language?: SupportedLanguage): string {
  return shouldUseChineseDefaultPrompt(language)
    ? DEFAULT_PROMPT_TEMPLATE_ZH_CN
    : DEFAULT_PROMPT_TEMPLATE_EN;
}

export function isDefaultPromptTemplate(promptTemplate: string): boolean {
  return (
    promptTemplate === DEFAULT_PROMPT_TEMPLATE_EN ||
    promptTemplate === DEFAULT_PROMPT_TEMPLATE_ZH_CN
  );
}

export function normalizeRecordsPageSize(value: unknown): RecordsPageSize {
  return RECORDS_PAGE_SIZE_OPTIONS.includes(value as RecordsPageSize)
    ? (value as RecordsPageSize)
    : DEFAULT_RECORDS_PAGE_SIZE;
}

export function getLlmProviderPreset(provider: LlmProvider): LlmProviderPreset {
  return (
    LLM_PROVIDER_PRESETS.find((preset) => preset.value === provider) ??
    LLM_PROVIDER_PRESETS[0]
  );
}

export function normalizeLlmProvider(value: unknown): LlmProvider {
  return LLM_PROVIDER_PRESETS.some((preset) => preset.value === value)
    ? (value as LlmProvider)
    : DEFAULT_LLM_PROVIDER;
}

export function normalizeLlmProviderConfig(
  provider: LlmProvider,
  config?: Partial<LlmProviderConfig>,
): LlmProviderConfig {
  const preset = getLlmProviderPreset(provider);
  const hasBaseUrl = config?.baseUrl !== undefined;
  const hasModel = config?.model !== undefined;

  return {
    baseUrl:
      provider === "custom"
        ? hasBaseUrl
          ? (config?.baseUrl ?? "")
          : preset.baseUrl
        : preset.baseUrl,
    apiKey: config?.apiKey ?? "",
    model: hasModel ? (config?.model ?? "") : preset.model,
  };
}

export function createDefaultLlmProviderConfigs(): LlmProviderConfigs {
  return Object.fromEntries(
    LLM_PROVIDER_PRESETS.map((preset) => [
      preset.value,
      normalizeLlmProviderConfig(preset.value),
    ]),
  ) as LlmProviderConfigs;
}

export function getEffectiveLlmConfig(llm: LlmConfig): EffectiveLlmConfig {
  const provider = normalizeLlmProvider(llm.provider);
  const config = normalizeLlmProviderConfig(provider, llm.providers[provider]);

  return {
    provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    provider: DEFAULT_LLM_PROVIDER,
    providers: createDefaultLlmProviderConfigs(),
    temperature: 0.2,
    timeoutMs: 30000,
    promptTemplate: getDefaultPromptTemplate("en"),
  },
  pronunciation: {
    merriamWebsterApiKey: "",
  },
  ui: {
    defaultHighlightColor: "yellow",
    language: "en",
    autoCloseLookupPanelOnCopy: false,
    recordsPageSize: DEFAULT_RECORDS_PAGE_SIZE,
  },
};

export const SCHEMA_VERSION = 2;
