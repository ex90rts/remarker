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
  sourceUrl: string;
  sourceTitle: string;
  anchor?: TextAnchor;
  model: string;
  result: string;
  createdAt: string;
}

export interface StartupCache {
  globalEnabled: boolean;
  disabledSites: string[];
  schemaVersion: number;
}

const DEFAULT_PROMPT_TEMPLATE =
  "You are a knowledgeable, trend-savvy linguist. Below, you'll help a reader complete the following task.\n\nTask:\n{{task}}\n\nSelection:\n{{selection}}\n\nContext:\n{{context}}\n\nRequirements:\n- Answer in the target language using clear, natural wording.\n- Stay grounded in the provided context.\n- If the task is word explanation, include the contextual meaning, part of speech when useful, and reusable expression notes.\n- If the task is translation, translate the selected text into the target language according to the context and briefly explain key expressions when useful.\n- Must be returned in Markdown format.";

export function getDefaultPromptTemplate(): string {
  return DEFAULT_PROMPT_TEMPLATE;
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
    promptTemplate: DEFAULT_PROMPT_TEMPLATE,
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

export const SCHEMA_VERSION = 1;
