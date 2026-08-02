import { describe, expect, it } from "vitest";
import { getSelectionKind, isSingleEnglishWord } from "../word";

describe("word detection", () => {
  it("accepts simple words, hyphenated words, and contractions", () => {
    expect(isSingleEnglishWord("architecture")).toBe(true);
    expect(isSingleEnglishWord("state-of-the-art")).toBe(true);
    expect(isSingleEnglishWord("don't")).toBe(true);
  });

  it("rejects technical identifiers and phrases", () => {
    expect(isSingleEnglishWord("HTTP/2")).toBe(false);
    expect(isSingleEnglishWord("useEffect")).toBe(true);
    expect(isSingleEnglishWord("state of the art")).toBe(false);
  });

  it("returns phrase for non-word selections", () => {
    expect(getSelectionKind("hello world")).toBe("phrase");
  });

  it("recognizes CJK words and rejects sentences", () => {
    expect(getSelectionKind("中", "zh-CN")).toBe("word");
    expect(getSelectionKind("词汇", "zh-CN")).toBe("word");
    expect(getSelectionKind("这是一个句子。", "zh-CN")).toBe("phrase");
    expect(getSelectionKind("テスト", "ja-JP")).toBe("word");
    expect(getSelectionKind("테스트", "ko-KR")).toBe("word");
    expect(getSelectionKind("あ", "ja-JP")).toBe("word");
    expect(getSelectionKind("中文 English", "zh-CN")).toBe("phrase");
    expect(getSelectionKind("中文！", "zh-CN")).toBe("phrase");
  });

  it("uses Unicode script runs when Intl.Segmenter is unavailable", () => {
    const segmenter = Intl.Segmenter;
    Object.defineProperty(Intl, "Segmenter", { configurable: true, value: undefined });
    try {
      expect(getSelectionKind("词汇", "zh-CN")).toBe("word");
      expect(getSelectionKind("词汇 测试", "zh-CN")).toBe("phrase");
      expect(getSelectionKind("中文English", "zh-CN")).toBe("phrase");
    } finally {
      Object.defineProperty(Intl, "Segmenter", { configurable: true, value: segmenter });
    }
  });
});
