import { describe, expect, it } from "vitest";
import {
  buildReadingAnalysisUserPrompt,
  READING_ANALYSIS_FIELD_LIMIT,
  READING_ANALYSIS_HIGHLIGHT_LIMIT,
} from "../reading-analysis";
import type { HighlightRecord } from "../types";

function makeHighlight(
  id: string,
  createdAt: string,
  overrides: Partial<HighlightRecord> = {},
): HighlightRecord {
  return {
    id,
    urlKey: `https://example.com/${id}`,
    sourceUrl: `https://example.com/${id}`,
    sourceTitle: `Source ${id}`,
    selectedText: `Highlight ${id}`,
    color: "yellow",
    anchor: {
      selectedText: `Highlight ${id}`,
      prefixText: "",
      suffixText: "",
      textStart: 0,
      textEnd: 1,
    },
    status: "active",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe("buildReadingAnalysisUserPrompt", () => {
  it("sorts newest first, includes notes, and omits empty notes", () => {
    const prompt = buildReadingAnalysisUserPrompt(
      [
        makeHighlight("older", "2026-01-01T00:00:00.000Z", { note: "" }),
        makeHighlight("newer", "2026-01-02T00:00:00.000Z", {
          note: "My note",
        }),
      ],
      "zh-CN",
    );

    expect(prompt.indexOf("Highlight newer")).toBeLessThan(
      prompt.indexOf("Highlight older"),
    );
    expect(prompt).toContain("笔记: My note");
    expect(prompt.match(/笔记:/g)).toHaveLength(1);
  });

  it("uses at most 50 records and truncates every field to 200 characters", () => {
    const longText = "x".repeat(READING_ANALYSIS_FIELD_LIMIT + 20);
    const highlights = Array.from(
      { length: READING_ANALYSIS_HIGHLIGHT_LIMIT + 2 },
      (_, index) =>
        makeHighlight(
          String(index),
          new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
          {
            selectedText: longText,
            sourceTitle: longText,
            sourceUrl: longText,
            note: longText,
          },
        ),
    );

    const prompt = buildReadingAnalysisUserPrompt(highlights, "zh-CN");

    expect(prompt).toContain("最近 50 条划线数据");
    expect(prompt).toContain(`[${READING_ANALYSIS_HIGHLIGHT_LIMIT}]`);
    expect(prompt).not.toContain(`[${READING_ANALYSIS_HIGHLIGHT_LIMIT + 1}]`);
    expect(prompt).toContain(`${"x".repeat(READING_ANALYSIS_FIELD_LIMIT)}…`);
  });

  it.each([
    ["zh-CN", "简体中文"],
    ["zh-TW", "繁体中文"],
    ["en", "英语"],
    ["es", "西班牙语"],
  ] as const)(
    "adds the %s output language to the user prompt",
    (language, languageName) => {
      const prompt = buildReadingAnalysisUserPrompt(
        [makeHighlight("one", "2026-01-01T00:00:00.000Z")],
        language,
      );

      expect(prompt).toContain(
        `不要把缺失的笔记当作负面信号。\n分析结果输出语种必须是${languageName}`,
      );
    },
  );
});
