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

export const READING_ANALYSIS_SYSTEM_PROMPT = `你是一名严谨的阅读画像分析师。用户喜欢阅读并学习外文内容，请仅根据所提供的近期划线数据，分析用户的阅读偏好和阅读风格。

请覆盖以下维度：
- 反复出现的主题、来源类型、语言以及知识兴趣。
- 知识深度与广度，包括划线是否体现持续探究，或更偏向碎片化浏览。
- 用户偏好的写作风格、论证方式，以及更容易被用户保存的内容类型。
- 可能存在的认知盲区或信息茧房，并从主题、观点、地域、语言和来源多样性进行判断。
- 提供三条具体、可执行的建议，帮助用户拓宽或深化后续阅读。

请区分直接证据与推测性判断，引用有代表性的划线编号；样本不足时必须明确说明。不要对用户的身份或人格作出诊断式结论。返回内容应简洁、结构清晰，并使用 Markdown 格式。`;

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

  return `请分析以下最近 ${recentHighlights.length} 条划线数据。每条数据按创建时间从新到旧排列；不要把缺失的笔记当作负面信号。分析结果输出语种必须是${outputLanguage}。\n\n${records.join("\n\n")}`;
}

function truncateField(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const characters = Array.from(normalized);
  return characters.length > READING_ANALYSIS_FIELD_LIMIT
    ? `${characters.slice(0, READING_ANALYSIS_FIELD_LIMIT).join("")}…`
    : normalized;
}
