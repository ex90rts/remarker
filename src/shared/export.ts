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
  const settings = sanitizeSettings(input.settings, input.includeSensitive);
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

function sanitizeSettings(settingsInput: unknown, includeSensitive: boolean): Record<string, unknown> {
  const settings = structuredClone(settingsInput) as Record<string, unknown>;
  if (!includeSensitive && typeof settings.llm === "object" && settings.llm) {
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

  if (!includeSensitive && typeof settings.pronunciation === "object" && settings.pronunciation) {
    (settings.pronunciation as Record<string, unknown>).merriamWebsterApiKey = "";
  }

  return settings;
}

export function createHighlightsMarkdownExport(highlights: HighlightRecord[]): string {
  return createObsidianHighlightsExport(highlights);
}

export function createObsidianHighlightsExport(highlights: HighlightRecord[]): string {
  const lines = [
    "---",
    "type: remarker-highlights",
    `exportedAt: ${new Date().toISOString()}`,
    `recordCount: ${highlights.length}`,
    "tags:",
    "  - remarker",
    "  - highlights",
    "---",
    "",
    "# Remarker highlights",
    "",
  ];

  appendGroupedHighlights(lines, highlights, "obsidian");
  return lines.join("\n").trimEnd();
}

export function createNotionHighlightsExport(highlights: HighlightRecord[]): string {
  const lines = ["# Remarker Highlights", ""];
  appendGroupedHighlights(lines, highlights, "notion");
  return lines.join("\n").trimEnd();
}

function appendGroupedHighlights(
  lines: string[],
  highlights: HighlightRecord[],
  format: "obsidian" | "notion",
): void {
  const groups = new Map<string, HighlightRecord[]>();
  for (const highlight of highlights) {
    const key = `${highlight.sourceTitle || highlight.sourceUrl}\n${highlight.sourceUrl}`;
    groups.set(key, [...(groups.get(key) ?? []), highlight]);
  }

  for (const records of groups.values()) {
    const source = records[0];
    lines.push(`## ${formatMarkdownHeading(source.sourceTitle, "Untitled")}`);
    lines.push(`[Source](${source.sourceUrl})`, "");
    for (const highlight of records) {
      const quote = highlight.selectedText.split("\n").map((line) => `> ${line}`).join("\n");
      lines.push(quote, "");
      if (highlight.note) lines.push(`**Note:** ${highlight.note}`, "");
      lines.push(
        format === "obsidian"
          ? `- color: ${highlight.color}`
          : `Color: ${highlight.color}`,
        format === "obsidian"
          ? `- createdAt: ${highlight.createdAt}`
          : `Created: ${highlight.createdAt}`,
        "",
      );
    }
  }
}

export function createIncrementalBackupJson(input: {
  settings: unknown;
  footprints: FootprintRecord[];
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  since?: string;
  exportedAt?: string;
  includeSensitive?: boolean;
}): string {
  const exportedAt = input.exportedAt ?? new Date().toISOString();
  const since = input.since;
  const changed = <T extends { updatedAt: string }>(records: T[]) =>
    since ? records.filter((record) => record.updatedAt > since) : records;
  return JSON.stringify(
    {
      exportMode: "incremental",
      since,
      exportedAt,
      schemaVersion: SCHEMA_VERSION,
      settings: sanitizeSettings(input.settings, Boolean(input.includeSensitive)),
      footprints: changed(input.footprints),
      highlights: changed(input.highlights),
      vocabulary: changed(input.vocabulary),
    },
    null,
    2,
  );
}

export function createVocabularyMarkdownExport(vocabulary: VocabularyRecord[]): string {
  return createObsidianVocabularyExport(vocabulary);
}

export function createTranslationMarkdownExport(translations: VocabularyRecord[]): string {
  return createObsidianTranslationExport(translations);
}

export function createObsidianVocabularyExport(
  vocabulary: VocabularyRecord[],
): string {
  return createObsidianLookupExport(vocabulary, VOCABULARY_EXPORT_CONFIG);
}

export function createNotionVocabularyExport(
  vocabulary: VocabularyRecord[],
): string {
  return createNotionLookupExport(vocabulary, VOCABULARY_EXPORT_CONFIG);
}

export function createObsidianTranslationExport(
  translations: VocabularyRecord[],
): string {
  return createObsidianLookupExport(translations, TRANSLATION_EXPORT_CONFIG);
}

export function createNotionTranslationExport(
  translations: VocabularyRecord[],
): string {
  return createNotionLookupExport(translations, TRANSLATION_EXPORT_CONFIG);
}

interface LookupExportConfig {
  documentTitle: string;
  frontmatterType: string;
  tag: string;
  resultHeading: string;
  includePhonetic: boolean;
}

const VOCABULARY_EXPORT_CONFIG: LookupExportConfig = {
  documentTitle: "ReMarker Vocabulary",
  frontmatterType: "remarker-vocabulary",
  tag: "vocabulary",
  resultHeading: "Explanation",
  includePhonetic: true,
};

const TRANSLATION_EXPORT_CONFIG: LookupExportConfig = {
  documentTitle: "ReMarker Translations",
  frontmatterType: "remarker-translations",
  tag: "translations",
  resultHeading: "Translation",
  includePhonetic: false,
};

function createObsidianLookupExport(
  records: VocabularyRecord[],
  config: LookupExportConfig,
): string {
  const lines = [
    "---",
    `type: ${config.frontmatterType}`,
    `exportedAt: ${new Date().toISOString()}`,
    `recordCount: ${records.length}`,
    "tags:",
    "  - remarker",
    `  - ${config.tag}`,
    "---",
    "",
    `# ${config.documentTitle}`,
    "",
  ];

  for (const item of records) {
    lines.push(`## ${formatMarkdownHeading(item.word, "Untitled")}`);
    if (config.includePhonetic && item.phonetic) {
      lines.push(`- phonetic: ${item.phonetic}`);
    }
    lines.push(`- sourceTitle: ${item.sourceTitle || ""}`);
    lines.push(`- sourceLink: ${item.sourceUrl}`);
    lines.push(`- context: ${item.contextSentence || ""}`);
    lines.push(`- createdAt: ${item.createdAt}`, "");
    appendLookupResult(lines, config.resultHeading, item.translation ?? "");
  }

  return lines.join("\n").trimEnd();
}

function createNotionLookupExport(
  records: VocabularyRecord[],
  config: LookupExportConfig,
): string {
  const lines = [`# ${config.documentTitle}`, ""];

  for (const item of records) {
    lines.push(`## ${formatMarkdownHeading(item.word, "Untitled")}`);
    lines.push("");
    if (config.includePhonetic && item.phonetic) {
      lines.push(`**Phonetic:** ${item.phonetic}`, "");
    }
    if (item.contextSentence) {
      lines.push(`**Context:** ${item.contextSentence}`, "");
    }
    lines.push(
      `**Source:** [${item.sourceTitle || item.sourceUrl}](${item.sourceUrl})`,
      "",
      `**Created:** ${item.createdAt}`,
      "",
    );
    appendLookupResult(lines, config.resultHeading, item.translation ?? "");
  }

  return lines.join("\n").trimEnd();
}

function appendLookupResult(
  lines: string[],
  heading: string,
  result: string,
): void {
  lines.push(`### ${heading}`, "", result || "", "");
}

function formatMarkdownHeading(value: string, fallback: string): string {
  return value.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim() || fallback;
}
