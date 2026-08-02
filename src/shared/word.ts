const SINGLE_WORD_PATTERN = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;
const CJK_SCRIPT_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const LATIN_SCRIPT_PATTERN = /\p{Script=Latin}/u;
const WORD_CONTENT_PATTERN = /[\p{L}\p{M}\p{N}]/u;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?。！？；;：:]$/u;

export function isSingleEnglishWord(value: string): boolean {
  return SINGLE_WORD_PATTERN.test(value.trim());
}

export function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

export function getSelectionKind(
  value: string,
  locale = "en",
): "word" | "phrase" {
  const text = value.trim();
  if (isSingleEnglishWord(text)) return "word";
  if (
    !text ||
    !CJK_SCRIPT_PATTERN.test(text) ||
    LATIN_SCRIPT_PATTERN.test(text) ||
    TERMINAL_PUNCTUATION_PATTERN.test(text)
  ) {
    return "phrase";
  }
  if (Array.from(text).length === 1) return "word";

  const Segmenter = Intl.Segmenter;
  if (Segmenter) {
    const segments = Array.from(new Segmenter(locale, { granularity: "word" }).segment(text))
      .filter((segment) => segment.isWordLike && WORD_CONTENT_PATTERN.test(segment.segment));
    return segments.length === 1 ? "word" : "phrase";
  }

  const fallbackSegments = text.match(
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu,
  );
  return fallbackSegments?.length === 1 ? "word" : "phrase";
}

export function detectSpeechLanguage(value: string, uiLanguage = "en"): string {
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(value)) return "ja-JP";
  if (/\p{Script=Hangul}/u.test(value)) return "ko-KR";
  if (/\p{Script=Han}/u.test(value)) return uiLanguage === "zh-TW" ? "zh-TW" : "zh-CN";
  return uiLanguage;
}
