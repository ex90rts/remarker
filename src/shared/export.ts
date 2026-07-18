import type {
  FootprintRecord,
  HighlightRecord,
  VocabularyRecord,
} from "./types";
import { SCHEMA_VERSION } from "./types";

export function createBackupJson(input: {
  settings: unknown;
  footprints: FootprintRecord[];
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  includeSensitive: boolean;
}): string {
  const settings = structuredClone(input.settings) as Record<string, unknown>;
  const footprints = input.footprints.map((record) => ({
    urlKey: record.urlKey,
    sourceUrl: record.sourceUrl,
    sourceTitle: record.sourceTitle,
    siteName: record.siteName,
    starred: record.starred,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));

  if (!input.includeSensitive && typeof settings.llm === "object" && settings.llm) {
    const llm = settings.llm as Record<string, unknown>;
    llm.apiKey = "";
    if (typeof llm.providers === "object" && llm.providers) {
      for (const providerConfig of Object.values(llm.providers)) {
        if (typeof providerConfig === "object" && providerConfig) {
          (providerConfig as Record<string, unknown>).apiKey = "";
        }
      }
    }
  }

  if (!input.includeSensitive && typeof settings.pronunciation === "object" && settings.pronunciation) {
    (settings.pronunciation as Record<string, unknown>).merriamWebsterApiKey = "";
  }

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      settings,
      footprints,
      highlights: input.highlights,
      vocabulary: input.vocabulary
    },
    null,
    2
  );
}

export function createHighlightsMarkdownExport(highlights: HighlightRecord[]): string {
  const lines = ["# Remarker highlights", "", "## Highlights", ""];

  for (const highlight of highlights) {
    lines.push(`- ${highlight.selectedText}`);
    lines.push(`  - color: ${highlight.color}`);
    lines.push(`  - sourceTitle: ${highlight.sourceTitle || ""}`);
    lines.push(`  - sourceLink: ${highlight.sourceUrl}`);
    lines.push(`  - createdAt: ${highlight.createdAt}`);
  }

  return lines.join("\n");
}

export function createVocabularyMarkdownExport(vocabulary: VocabularyRecord[]): string {
  return createLookupMarkdownExport(vocabulary, "# Remarker new words");
}

export function createTranslationMarkdownExport(translations: VocabularyRecord[]): string {
  return createLookupMarkdownExport(translations, "# Remarker translations");
}

function createLookupMarkdownExport(records: VocabularyRecord[], title: string): string {
  const lines = [title, ""];

  for (const item of records) {
    lines.push(`## ${formatMarkdownHeading(item.word, "Untitled")}`);
    lines.push(`- sourceTitle: ${item.sourceTitle || ""}`);
    lines.push(`- sourceLink: ${item.sourceUrl}`);
    lines.push(`- context: ${item.contextSentence || ""}`);
    lines.push("- explain:");
    lines.push("  ```markdown");
    lines.push(indentCodeBlock(item.translation || ""));
    lines.push("  ```");
    lines.push(`- createdAt: ${item.createdAt}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatMarkdownHeading(value: string, fallback: string): string {
  return value.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim() || fallback;
}

function indentCodeBlock(value: string): string {
  return value
    .replaceAll("```", "\\`\\`\\`")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}
