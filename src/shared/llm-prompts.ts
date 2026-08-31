import type { SupportedLanguage } from "./i18n";
import type { HighlightRecord } from "./types";

export const READING_ANALYSIS_HIGHLIGHT_LIMIT = 50;
export const READING_ANALYSIS_FIELD_LIMIT = 200;

const READING_ANALYSIS_OUTPUT_LANGUAGE_NAMES: Record<
  SupportedLanguage,
  string
> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  en: "英语",
  es: "西班牙语",
};

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

function buildChatMessages(input: {
  systemPrompt: string;
  userPrompt: string;
}): ChatMessage[] {
  return [
    { role: "system", content: input.systemPrompt.trim() },
    { role: "user", content: input.userPrompt },
  ];
}

export function buildSelectionChatMessages(input: {
  systemPrompt: string;
  targetLanguage: string;
  selectedText: string;
  context: string;
}): ChatMessage[] {
  return buildChatMessages({
    systemPrompt: input.systemPrompt,
    userPrompt: `选中内容：\n${input.selectedText}\n\n上下文：\n${input.context}\n\n回复语种：${input.targetLanguage}`,
  });
}

export function buildReadingAnalysisChatMessages(input: {
  systemPrompt: string;
  highlights: HighlightRecord[];
  language: SupportedLanguage;
}): ChatMessage[] {
  return buildChatMessages({
    systemPrompt: input.systemPrompt,
    userPrompt: buildReadingAnalysisUserPrompt(
      input.highlights,
      input.language,
    ),
  });
}

export function buildLanguageChunkAnalysisChatMessages(input: {
  systemPrompt: string;
  selectedText: string;
}): ChatMessage[] {
  return buildChatMessages({
    systemPrompt: input.systemPrompt,
    userPrompt: input.selectedText.trim(),
  });
}

export function buildReadingAnalysisUserPrompt(
  highlights: HighlightRecord[],
  language: SupportedLanguage,
): string {
  const outputLanguage = READING_ANALYSIS_OUTPUT_LANGUAGE_NAMES[language];
  const recentHighlights = [...highlights]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, READING_ANALYSIS_HIGHLIGHT_LIMIT);

  const records = recentHighlights.map((highlight, index) => {
    const source = highlight.sourceTitle
      ? `${highlight.sourceTitle} (${highlight.sourceUrl})`
      : highlight.sourceUrl;
    const lines = [
      `[${index + 1}]`,
      `划线文本: ${truncateReadingAnalysisField(highlight.selectedText)}`,
      `来源: ${truncateReadingAnalysisField(source)}`,
    ];
    if (highlight.note?.trim()) {
      lines.push(`笔记: ${truncateReadingAnalysisField(highlight.note)}`);
    }
    return lines.join("\n");
  });

  return `请分析以下最近 ${recentHighlights.length} 条划线数据。每条数据按创建时间从新到旧排列；不要把缺失的笔记当作负面信号。\n分析结果输出语种必须是${outputLanguage}\n\n${records.join("\n\n")}`;
}

function truncateReadingAnalysisField(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > READING_ANALYSIS_FIELD_LIMIT
    ? `${characters.slice(0, READING_ANALYSIS_FIELD_LIMIT).join("")}…`
    : normalized;
}
