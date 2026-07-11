import type { SupportedLanguage } from "./i18n";

export type HighlightStatus = "pending" | "active" | "not_found" | "ambiguous";

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";

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
  translation?: string;
  audioProvider?: string;
  audioUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
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
  model: string;
  result: string;
  createdAt: string;
}

export interface StartupCache {
  globalEnabled: boolean;
  disabledSites: string[];
  schemaVersion: number;
}

const LEGACY_CHINESE_PROMPT_TEMPLATE =
  "你是一位学识渊博、紧跟潮流的中英双语语言学家。下面，你将帮助一位正在阅读英文文章的读者完成以下任务。\n\n任务：{{task}}\n\n选中文本：\n{{selection}}\n\n上下文：\n{{context}}\n\n要求：\n- 使用自然、准确的中文回答。\n- 严格基于提供的上下文，不要脱离上下文发挥。\n- 如果任务是查词，说明该词在当前语境中的含义；必要时补充词性、搭配和可复用英文表达。\n- 如果任务是翻译，结合上下文翻译选中文本，并在有帮助时简要解释关键表达。\n- 必须返回 Markdown 格式。";

const LEGACY_TARGET_LANGUAGE_PROMPT_TEMPLATE =
  "You are a knowledgeable, trend-savvy linguist. Below, you'll help a reader who is reading an English article complete the following task.\n\nTarget language: {{targetLanguage}}\n\nTask: {{task}}\n\nSelection:\n{{selection}}\n\nContext:\n{{context}}\n\nRequirements:\n- Answer in the target language using clear, natural wording.\n- Stay grounded in the provided context.\n- If the task is word explanation, include the contextual meaning, part of speech when useful, and reusable expression notes.\n- If the task is translation, translate the selected text into the target language according to the context and briefly explain key expressions when useful.\n- Must be returned in Markdown format.";

const DEFAULT_PROMPT_TEMPLATE =
  "You are a knowledgeable, trend-savvy linguist. Below, you'll help a reader complete the following task.\n\nTask: {{task}}\n\nSelection:\n{{selection}}\n\nContext:\n{{context}}\n\nRequirements:\n- Answer in the target language using clear, natural wording.\n- Stay grounded in the provided context.\n- If the task is word explanation, include the contextual meaning, part of speech when useful, and reusable expression notes.\n- If the task is translation, translate the selected text into the target language according to the context and briefly explain key expressions when useful.\n- Must be returned in Markdown format.";

export const DEFAULT_PROMPT_TEMPLATES = {
  en: DEFAULT_PROMPT_TEMPLATE,
  legacyZh: LEGACY_CHINESE_PROMPT_TEMPLATE,
  legacyTargetLanguage: LEGACY_TARGET_LANGUAGE_PROMPT_TEMPLATE,
} as const;

export function getDefaultPromptTemplate(_language?: SupportedLanguage): string {
  return DEFAULT_PROMPT_TEMPLATE;
}

export function isDefaultPromptTemplate(promptTemplate: string): boolean {
  const normalized = promptTemplate.trim();
  return Object.values(DEFAULT_PROMPT_TEMPLATES).some(
    (template) => template.trim() === normalized,
  );
}

export const DEFAULT_SETTINGS: AppSettings = {
  llm: {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4.1-mini",
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
  },
};

export const SCHEMA_VERSION = 1;
