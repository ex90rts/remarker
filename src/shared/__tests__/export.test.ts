import { describe, expect, it } from "vitest";
import { createBackupJson, createHighlightsMarkdownExport, createVocabularyMarkdownExport } from "../export";
import type { HighlightRecord, VocabularyRecord } from "../types";

const highlight: HighlightRecord = {
  id: "h1",
  urlKey: "https://example.com/doc",
  sourceUrl: "https://example.com/doc",
  sourceTitle: "Doc",
  selectedText: "A useful sentence.",
  color: "yellow",
  anchor: {
    selectedText: "A useful sentence.",
    prefixText: "",
    suffixText: "",
    textStart: 0,
    textEnd: 18
  },
  status: "active",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z"
};

const vocabulary: VocabularyRecord = {
  id: "v1",
  word: "useful",
  normalizedWord: "useful",
  sourceUrl: "https://example.com/doc",
  sourceTitle: "Doc",
  contextSentence: "A useful sentence.",
  translation: "有用的",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z"
};

describe("export helpers", () => {
  it("excludes sensitive settings by default", () => {
    const json = createBackupJson({
      settings: {
        llm: {
          apiKey: "legacy-secret",
          providers: {
            zhipu: { apiKey: "zhipu-secret" },
            gemini: { apiKey: "gemini-secret" }
          }
        },
        pronunciation: { merriamWebsterApiKey: "dict-secret" }
      },
      highlights: [highlight],
      vocabulary: [vocabulary],
      includeSensitive: false
    });

    expect(json).not.toContain("legacy-secret");
    expect(json).not.toContain("zhipu-secret");
    expect(json).not.toContain("gemini-secret");
    expect(json).not.toContain("dict-secret");
    expect(json).not.toContain("explanations");
  });

  it("creates highlights markdown", () => {
    const markdown = createHighlightsMarkdownExport([highlight]);
    expect(markdown).toContain("# Remarker highlights");
    expect(markdown).toContain("- A useful sentence.");
    expect(markdown).toContain("  - color: yellow");
    expect(markdown).toContain("  - sourceTitle: Doc");
    expect(markdown).toContain("  - sourceLink: https://example.com/doc");
  });

  it("creates vocabulary markdown", () => {
    const markdown = createVocabularyMarkdownExport([vocabulary]);
    expect(markdown).toContain("# Remarker new words");
    expect(markdown).toContain("## useful");
    expect(markdown).toContain("- sourceTitle: Doc");
    expect(markdown).toContain("- sourceLink: https://example.com/doc");
    expect(markdown).toContain("- context: A useful sentence.");
    expect(markdown).toContain("  ```markdown\n  有用的\n  ```");
  });
});
