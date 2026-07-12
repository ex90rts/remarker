import type { HighlightRecord, VocabularyRecord } from "./types";

export function createBackupJson(input: {
  settings: unknown;
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  includeSensitive: boolean;
}): string {
  const settings = structuredClone(input.settings) as Record<string, unknown>;

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
      schemaVersion: 1,
      settings,
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
  const lines = ["# Remarker new words", ""];

  for (const item of vocabulary) {
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
