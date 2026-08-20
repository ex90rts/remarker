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
    model: "openrouter/free",
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
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingAnalysisRecord {
  id: string;
  result: string;
  highlightCount: number;
  createdAt: string;
}

export interface VocabularyRecord {
  id: string;
  /** Missing on legacy records; those records are word lookups. */
  selectionKind?: "word" | "text";
  word: string;
  normalizedWord: string;
  urlKey: string;
  sourceUrl: string;
  sourceTitle: string;
  contextSentence: string;
  anchor?: TextAnchor;
  translation?: string;
  cacheKey?: string;
  contextHash?: string;
  model?: string;
  audioProvider?: string;
  audioUrl?: string;
  phonetic?: string;
  reviewCount: number;
  easinessFactor: number;
  reviewIntervalDays: number;
  nextReviewAt: string;
  lastReviewAt?: string;
  reviewHistory?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfig {
  provider: LlmProvider;
  providers: LlmProviderConfigs;
  temperature: number;
  timeoutMs: number;
  lookupPromptTemplate: string;
  translationPromptTemplate: string;
  analysisPromptTemplate: string;
}

export type PromptTemplateType = "lookup" | "translation" | "analysis";

export interface ExportSettings {
  lastIncrementalExportAt?: string;
}

export interface UiPreferences {
  defaultHighlightColor: HighlightColor;
  language: SupportedLanguage;
  autoCloseLookupPanelOnCopy: boolean;
  recordsPageSize: RecordsPageSize;
}

export interface AppSettings {
  llm: LlmConfig;
  ui: UiPreferences;
  export: ExportSettings;
}

export interface SiteSetting {
  hostname: string;
  enabled: boolean;
  updatedAt: string;
}

export interface SelectionLookupResult {
  id: string;
  selectionKind: "word" | "text";
  selectedText: string;
  context: string;
  sourceUrl: string;
  sourceTitle: string;
  anchor?: TextAnchor;
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

export interface AudioCacheRecord {
  key: string;
  language: string;
  normalizedWord: string;
  provider: "youdao";
  mimeType?: string;
  audioBlob?: Blob;
  audioUrl?: string;
  phonetic?: string;
  createdAt: string;
  lastAccessedAt: string;
}

export interface StartupCache {
  globalEnabled: boolean;
  disabledSites: string[];
  schemaVersion: number;
}

const DEFAULT_LOOKUP_PROMPT_TEMPLATE_EN =
  "You are a knowledgeable, trend-savvy linguist. Following the requirements below, explain the selected word in context.\n\nRequirements:\n- Infer the source language from the context; default to English when uncertain.\n- Determine the best meaning of the selected word in the current context, then provide a context-based analysis and supplement it with other common meanings and expanded usage.\n- Return content in this exact order with no extraneous content: Current Meaning, Context Analysis, Additional Meanings, Common Usage and Example Sentences.\n- The returned content must be in Markdown source format.\n\nSelected Word:\n{{selection}}\n\nContext:\n{{context}}";

const DEFAULT_TRANSLATION_PROMPT_TEMPLATE_EN =
  "You are a knowledgeable, trend-savvy linguist. Following the requirements below, translate the selected content in context.\n\nRequirements:\n- Infer the source language from the context; default to English when uncertain.\n- Translate the selected content completely based on the context, then provide a context-based analysis and extract high-frequency vocabulary and common phrases.\n- Return content in this exact order with no extraneous content: Best Translation, Context Analysis, High-Frequency Vocabulary and Common Phrases.\n- The returned content must be in Markdown source format.\n\nSelected Content:\n{{selection}}\n\nContext:\n{{context}}";

const DEFAULT_LOOKUP_PROMPT_TEMPLATE_ZH_CN =
  "你是一位知识丰富、熟悉流行表达的语言学专家，请根据要求结合上下文解释选中的词语。\n\n要求：\n- 从上下文推断源语言，无法确定时默认按英语处理。\n- 结合上下文判断选中词语在当前语境中的最佳含义，然后给出基于上下文的解析，并补充常见其他含义和用法扩展。\n- 返回内容必须严格按以下顺序组织，不要添加无关内容：当前含义、上下文解析、其他含义、常见用法和例句。\n- 返回内容必须是 Markdown 源码格式。\n\n选中词语：\n{{selection}}\n\n上下文：\n{{context}}";

const DEFAULT_TRANSLATION_PROMPT_TEMPLATE_ZH_CN =
  "你是一位知识丰富、熟悉流行表达的语言学专家，请根据要求结合上下文翻译选中内容。\n\n要求：\n- 从上下文推断源语言，无法确定时默认按英语处理。\n- 结合上下文完整翻译选中内容，然后给出基于上下文的解析，并提取高频词汇和常用短语。\n- 返回内容必须严格按以下顺序组织，不要添加无关内容：最佳翻译、上下文解析、高频词汇和常用短语。\n- 返回内容必须是 Markdown 源码格式。\n\n选中内容：\n{{selection}}\n\n上下文：\n{{context}}";

const DEFAULT_ANALYSIS_PROMPT_TEMPLATE_EN = `You are a rigorous reading-profile analyst. The user enjoys reading and learning from foreign-language content. Based only on the provided recent highlight data, analyze the user's reading preferences and reading style.

Cover the following dimensions:
- Recurring topics, source types, languages, and intellectual interests.
- Knowledge depth and breadth, including whether the highlights show sustained inquiry or fragmented browsing.
- Preferred writing styles, forms of argument, and types of content the user is more likely to save.
- Possible cognitive blind spots or information bubbles, considering diversity of topics, viewpoints, regions, languages, and sources.
- Three specific, actionable recommendations to help broaden or deepen future reading.

Distinguish direct evidence from tentative inference and cite representative highlight numbers. Explicitly state when the sample is insufficient. Do not make diagnostic conclusions about the user's identity or personality. Keep the response concise and well structured, and use Markdown format.`;

const DEFAULT_ANALYSIS_PROMPT_TEMPLATE_ZH_CN = `你是一名严谨的阅读画像分析师。用户喜欢阅读并学习外文内容，请仅根据所提供的近期划线数据，分析用户的阅读偏好和阅读风格。

请覆盖以下维度：
- 反复出现的主题、来源类型、语言以及知识兴趣。
- 知识深度与广度，包括划线是否体现持续探究，或更偏向碎片化浏览。
- 用户偏好的写作风格、论证方式，以及更容易被用户保存的内容类型。
- 可能存在的认知盲区或信息茧房，并从主题、观点、地域、语言和来源多样性进行判断。
- 提供三条具体、可执行的建议，帮助用户拓宽或深化后续阅读。

请区分直接证据与推测性判断，引用有代表性的划线编号；样本不足时必须明确说明。不要对用户的身份或人格作出诊断式结论。返回内容应简洁、结构清晰，并使用 Markdown 格式。`;

function shouldUseChineseDefaultPrompt(language?: SupportedLanguage): boolean {
  return language === "zh-CN" || language === "zh-TW";
}

export function getDefaultPromptTemplate(
  type: PromptTemplateType,
  language?: SupportedLanguage,
): string {
  const defaults: Record<PromptTemplateType, string> =
    shouldUseChineseDefaultPrompt(language)
      ? {
          lookup: DEFAULT_LOOKUP_PROMPT_TEMPLATE_ZH_CN,
          translation: DEFAULT_TRANSLATION_PROMPT_TEMPLATE_ZH_CN,
          analysis: DEFAULT_ANALYSIS_PROMPT_TEMPLATE_ZH_CN,
        }
      : {
          lookup: DEFAULT_LOOKUP_PROMPT_TEMPLATE_EN,
          translation: DEFAULT_TRANSLATION_PROMPT_TEMPLATE_EN,
          analysis: DEFAULT_ANALYSIS_PROMPT_TEMPLATE_EN,
        };
  return defaults[type];
}

export function isDefaultPromptTemplate(
  type: PromptTemplateType,
  promptTemplate: string,
): boolean {
  return [
    getDefaultPromptTemplate(type, "en"),
    getDefaultPromptTemplate(type, "zh-CN"),
  ].includes(promptTemplate);
}

export function getPromptTemplateForSelectionKind(
  llm: LlmConfig,
  selectionKind: "word" | "text",
): string {
  return selectionKind === "word"
    ? llm.lookupPromptTemplate
    : llm.translationPromptTemplate;
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
    lookupPromptTemplate: getDefaultPromptTemplate("lookup", "en"),
    translationPromptTemplate: getDefaultPromptTemplate("translation", "en"),
    analysisPromptTemplate: getDefaultPromptTemplate("analysis", "en"),
  },
  ui: {
    defaultHighlightColor: "yellow",
    language: "en",
    autoCloseLookupPanelOnCopy: false,
    recordsPageSize: DEFAULT_RECORDS_PAGE_SIZE,
  },
  export: {},
};

export const SCHEMA_VERSION = 6;
