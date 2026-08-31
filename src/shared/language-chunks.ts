import { stripOuterCodeFence } from "./markdown";

export interface LanguageChunkItem {
  chunk: string;
  meaning: string;
  useCases: string;
}

export interface LanguageChunkTextSegment {
  text: string;
  isMatch: boolean;
}

export const LANGUAGE_CHUNK_LIMIT = 5;

export function parseLanguageChunkItems(
  value: string,
): LanguageChunkItem[] | undefined {
  try {
    const parsed: unknown = JSON.parse(stripOuterCodeFence(value));
    if (!Array.isArray(parsed)) return undefined;

    const items = parsed.map(parseLanguageChunkItem);
    return items.every((item): item is LanguageChunkItem => item !== undefined)
      ? items
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeLanguageChunkResponse(value: string): string {
  const items = parseLanguageChunkItems(value);
  if (!items) {
    throw new Error(
      "Language chunk analysis did not return the expected JSON array.",
    );
  }
  return JSON.stringify(items.slice(0, LANGUAGE_CHUNK_LIMIT));
}

export function formatLanguageChunksAsMarkdown(value: string): string {
  const items = parseLanguageChunkItems(value);
  if (!items) return value.trim();

  return items
    .flatMap((item) => [
      `- **${formatMarkdownListText(item.chunk)}**`,
      `  - Meaning: ${formatMarkdownListText(item.meaning)}`,
      `  - Usage scenarios: ${formatMarkdownListText(item.useCases)}`,
    ])
    .join("\n");
}

export function segmentTextByLanguageChunk(
  text: string,
  chunk: string | undefined,
): LanguageChunkTextSegment[] {
  const words = chunk?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return [{ text, isMatch: false }];

  const pattern = words.map(escapeRegularExpression).join("\\s+");
  const matcher = new RegExp(pattern, "giu");
  const segments: LanguageChunkTextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(matcher)) {
    const start = match.index;
    const matchedText = match[0];
    if (start === undefined || !matchedText) continue;
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start), isMatch: false });
    }
    segments.push({ text: matchedText, isMatch: true });
    cursor = start + matchedText.length;
  }

  if (cursor === 0) return [{ text, isMatch: false }];
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMatch: false });
  }
  return segments;
}

function parseLanguageChunkItem(value: unknown): LanguageChunkItem | undefined {
  if (!value || typeof value !== "object") return undefined;

  const item = value as Record<string, unknown>;
  const chunk = readNonEmptyString(item.chunk);
  const meaning = readNonEmptyString(item.meaning);
  const useCases = readNonEmptyString(item.useCases);
  return chunk && meaning && useCases ? { chunk, meaning, useCases } : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function formatMarkdownListText(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
