export const DEFAULT_CONTEXT_CHAR_LIMIT = 500;

interface SemanticContextInput {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  maxLength?: number;
}

interface SemanticUnit {
  start: number;
  end: number;
}

const SENTENCE_BOUNDARIES = new Set([
  ".",
  "。",
  "．",
  "｡",
  ";",
  "；",
  "!",
  "！",
  "?",
  "？",
  "\n",
  "\r",
]);

const TRAILING_CLOSERS = new Set([
  '"',
  "'",
  "”",
  "’",
  ")",
  "）",
  "]",
  "】",
  "}",
  "》",
]);

export function createSemanticContext(input: SemanticContextInput): string {
  const maxLength = input.maxLength ?? DEFAULT_CONTEXT_CHAR_LIMIT;
  const text = input.text;
  const selectionStart = clamp(input.selectionStart, 0, text.length);
  const selectionEnd = clamp(input.selectionEnd, selectionStart, text.length);

  if (!text.trim() || maxLength <= 0) return "";

  const units = splitSemanticUnits(text);
  const currentUnitIndex = findUnitIndex(units, selectionStart, selectionEnd);
  if (currentUnitIndex === -1) {
    return trimAroundSelection(text, selectionStart, selectionEnd, maxLength);
  }

  let lower = currentUnitIndex;
  let upper = currentUnitIndex;

  if (getTrimmedSlice(text, units[lower].start, units[upper].end).length > maxLength) {
    return trimAroundSelection(
      text.slice(units[lower].start, units[upper].end),
      selectionStart - units[lower].start,
      selectionEnd - units[lower].start,
      maxLength,
    );
  }

  while (true) {
    let added = false;

    for (let i = 0; i < 2 && upper + 1 < units.length; i += 1) {
      if (!canIncludeUnits(text, units, lower, upper + 1, maxLength)) break;
      upper += 1;
      added = true;
    }

    if (lower > 0 && canIncludeUnits(text, units, lower - 1, upper, maxLength)) {
      lower -= 1;
      added = true;
    }

    if (!added) break;
  }

  return getTrimmedSlice(text, units[lower].start, units[upper].end);
}

function splitSemanticUnits(text: string): SemanticUnit[] {
  const units: SemanticUnit[] = [];
  let start = 0;
  let index = 0;

  while (index < text.length) {
    if (!isSentenceBoundary(text[index])) {
      index += 1;
      continue;
    }

    let end = index + 1;
    while (end < text.length && TRAILING_CLOSERS.has(text[end])) end += 1;
    while (end < text.length && /[ \t]/.test(text[end])) end += 1;
    while (end < text.length && isLineBreak(text[index]) && isLineBreak(text[end])) {
      end += 1;
    }

    pushNonEmptyUnit(units, text, start, end);
    start = end;
    index = end;
  }

  pushNonEmptyUnit(units, text, start, text.length);
  return units;
}

function pushNonEmptyUnit(
  units: SemanticUnit[],
  text: string,
  start: number,
  end: number,
): void {
  if (start >= end) return;
  if (!text.slice(start, end).trim()) return;
  units.push({ start, end });
}

function findUnitIndex(
  units: SemanticUnit[],
  selectionStart: number,
  selectionEnd: number,
): number {
  return units.findIndex(
    (unit) => selectionStart < unit.end && selectionEnd > unit.start,
  );
}

function canIncludeUnits(
  text: string,
  units: SemanticUnit[],
  lower: number,
  upper: number,
  maxLength: number,
): boolean {
  return getTrimmedSlice(text, units[lower].start, units[upper].end).length <= maxLength;
}

function trimAroundSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  maxLength: number,
): string {
  const safeSelectionStart = clamp(selectionStart, 0, text.length);
  const safeSelectionEnd = clamp(selectionEnd, safeSelectionStart, text.length);
  const selectionLength = safeSelectionEnd - safeSelectionStart;

  if (selectionLength >= maxLength) {
    return text.slice(safeSelectionStart, safeSelectionStart + maxLength).trim();
  }

  const remaining = maxLength - selectionLength;
  const preferredAfterLength = Math.floor(remaining * 0.65);
  const afterLength = Math.min(text.length - safeSelectionEnd, preferredAfterLength);
  const beforeLength = Math.min(
    safeSelectionStart,
    remaining - afterLength + Math.max(0, preferredAfterLength - afterLength),
  );
  const finalAfterLength = Math.min(
    text.length - safeSelectionEnd,
    remaining - beforeLength,
  );

  return text
    .slice(
      safeSelectionStart - beforeLength,
      safeSelectionEnd + finalAfterLength,
    )
    .trim();
}

function getTrimmedSlice(text: string, start: number, end: number): string {
  return text.slice(start, end).trim();
}

function isSentenceBoundary(value: string): boolean {
  return SENTENCE_BOUNDARIES.has(value);
}

function isLineBreak(value: string): boolean {
  return value === "\n" || value === "\r";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
