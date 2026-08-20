import type { HighlightRecord } from "./types";
import type { SupportedLanguage } from "./i18n";

export const READING_ANALYSIS_HIGHLIGHT_LIMIT = 50;
export const READING_ANALYSIS_FIELD_LIMIT = 200;
export const READING_ANALYSIS_HISTORY_LIMIT = 5;
export const READING_ANALYSIS_TEMPERATURE = 0.5;

const READING_ANALYSIS_OUTPUT_LANGUAGE_NAMES: Record<
  SupportedLanguage,
  string
> = {
  "zh-CN": "简体中文",
  "zh-TW": "繁体中文",
  en: "英语",
  es: "西班牙语",
};

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
      `划线文本: ${truncateField(highlight.selectedText)}`,
      `来源: ${truncateField(source)}`,
    ];
    if (highlight.note?.trim()) {
      lines.push(`笔记: ${truncateField(highlight.note)}`);
    }
    return lines.join("\n");
  });

  return `请分析以下最近 ${recentHighlights.length} 条划线数据。每条数据按创建时间从新到旧排列；不要把缺失的笔记当作负面信号。\n分析结果输出语种必须是${outputLanguage}\n\n${records.join("\n\n")}`;
}

function truncateField(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > READING_ANALYSIS_FIELD_LIMIT
    ? `${characters.slice(0, READING_ANALYSIS_FIELD_LIMIT).join("")}…`
    : normalized;
}
