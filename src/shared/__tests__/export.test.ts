import { describe, expect, it } from "vitest";
import {
  createBackupJson,
  createHighlightsMarkdownExport,
  createIncrementalBackupJson,
  createNotionHighlightsExport,
  createNotionTranslationExport,
  createNotionVocabularyExport,
  createObsidianTranslationExport,
  createObsidianVocabularyExport,
  createTranslationMarkdownExport,
  createVocabularyMarkdownExport,
} from "../export";
import type { FootprintRecord, HighlightRecord, VocabularyRecord } from "../types";

const footprint: FootprintRecord = {
  urlKey: "https://example.com/doc",
  sourceUrl: "https://example.com/doc",
  sourceTitle: "Doc",
  siteName: "example.com",
  starred: true,
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z"
};

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
  urlKey: "https://example.com/doc",
  sourceUrl: "https://example.com/doc",
  sourceTitle: "Doc",
  contextSentence: "A useful sentence.",
  translation: "有用的",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  reviewCount: 0,
  easinessFactor: 2.5,
  reviewIntervalDays: 0,
  nextReviewAt: "2026-07-07T00:00:00.000Z"
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
      footprints: [footprint],
      highlights: [highlight],
      vocabulary: [vocabulary],
      includeSensitive: false
    });

    expect(json).not.toContain("legacy-secret");
    expect(json).not.toContain("zhipu-secret");
    expect(json).not.toContain("gemini-secret");
    expect(json).not.toContain("dict-secret");
    expect(json).not.toContain("explanations");
    expect(json).toContain("\"footprints\"");
  });

  it("creates highlights markdown", () => {
    const markdown = createHighlightsMarkdownExport([highlight]);
    expect(markdown).toContain("# Remarker highlights");
    expect(markdown).toContain("type: remarker-highlights");
    expect(markdown).toContain("> A useful sentence.");
    expect(markdown).toContain("- color: yellow");
    expect(markdown).toContain("[Source](https://example.com/doc)");
  });

  it("creates Notion-friendly markdown", () => {
    const markdown = createNotionHighlightsExport([{ ...highlight, note: "Remember this" }]);
    expect(markdown).not.toContain("---");
    expect(markdown).toContain("## Doc");
    expect(markdown).toContain("**Note:** Remember this");
  });

  it("exports only records changed after the incremental watermark", () => {
    const json = createIncrementalBackupJson({
      settings: {},
      footprints: [footprint],
      highlights: [highlight],
      vocabulary: [{ ...vocabulary, updatedAt: "2026-07-09T00:00:00.000Z" }],
      since: "2026-07-08T00:00:00.000Z",
      exportedAt: "2026-07-10T00:00:00.000Z",
    });
    const parsed = JSON.parse(json);
    expect(parsed.exportMode).toBe("incremental");
    expect(parsed.highlights).toHaveLength(0);
    expect(parsed.vocabulary).toHaveLength(1);
  });

  it("removes secrets from incremental exports by default", () => {
    const json = createIncrementalBackupJson({
      settings: {
        llm: { providers: { custom: { apiKey: "incremental-secret" } } },
        pronunciation: { merriamWebsterApiKey: "dictionary-secret" },
      },
      footprints: [],
      highlights: [],
      vocabulary: [],
    });
    expect(json).not.toContain("incremental-secret");
    expect(json).not.toContain("dictionary-secret");
  });

  it("creates Obsidian vocabulary markdown", () => {
    const markdown = createObsidianVocabularyExport([
      { ...vocabulary, phonetic: "/ˈjuːsfəl/" },
    ]);
    expect(markdown).toContain("type: remarker-vocabulary");
    expect(markdown).toContain("recordCount: 1");
    expect(markdown).toContain("# ReMarker Vocabulary");
    expect(markdown).toContain("## useful");
    expect(markdown).toContain("- phonetic: /ˈjuːsfəl/");
    expect(markdown).toContain("- sourceTitle: Doc");
    expect(markdown).toContain("- sourceLink: https://example.com/doc");
    expect(markdown).toContain("- context: A useful sentence.");
    expect(markdown).toContain("### Explanation\n\n有用的");
    expect(createVocabularyMarkdownExport([vocabulary])).toContain(
      "type: remarker-vocabulary",
    );
  });

  it("creates Notion vocabulary markdown without frontmatter or code fences", () => {
    const markdown = createNotionVocabularyExport([
      { ...vocabulary, phonetic: "/ˈjuːsfəl/" },
    ]);
    expect(markdown).not.toContain("---");
    expect(markdown).not.toContain("```markdown");
    expect(markdown).toContain("# ReMarker Vocabulary");
    expect(markdown).toContain("**Phonetic:** /ˈjuːsfəl/");
    expect(markdown).toContain("**Context:** A useful sentence.");
    expect(markdown).toContain("**Source:** [Doc](https://example.com/doc)");
    expect(markdown).toContain("### Explanation\n\n有用的");
  });

  it("creates Obsidian translation markdown", () => {
    const translations = [
      { ...vocabulary, selectionKind: "text" as const, word: "A useful sentence." },
    ];
    const markdown = createObsidianTranslationExport(translations);

    expect(markdown).toContain("type: remarker-translations");
    expect(markdown).toContain("recordCount: 1");
    expect(markdown).toContain("# ReMarker Translations");
    expect(markdown).toContain("## A useful sentence.");
    expect(markdown).toContain("### Translation\n\n有用的");
    expect(createTranslationMarkdownExport(translations)).toContain(
      "type: remarker-translations",
    );
  });

  it("creates Notion translation markdown without frontmatter or code fences", () => {
    const markdown = createNotionTranslationExport([
      { ...vocabulary, selectionKind: "text", word: "A useful sentence." },
    ]);
    expect(markdown).not.toContain("---");
    expect(markdown).not.toContain("```markdown");
    expect(markdown).toContain("# ReMarker Translations");
    expect(markdown).toContain("**Context:** A useful sentence.");
    expect(markdown).toContain("**Source:** [Doc](https://example.com/doc)");
    expect(markdown).toContain("### Translation\n\n有用的");
  });
});
