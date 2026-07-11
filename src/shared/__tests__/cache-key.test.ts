import { describe, expect, it } from "vitest";
import { createExplanationCacheKey } from "../cache-key";

describe("createExplanationCacheKey", () => {
  it("uses selected text, normalized context, and model", async () => {
    const first = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A   stable architecture",
      model: "model-a",
      selectionKind: "word",
      promptTemplate: "Explain {{selection}}",
      targetLanguage: "Simplified Chinese"
    });
    const second = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A stable architecture",
      model: "model-a",
      selectionKind: "word",
      promptTemplate: "Explain   {{selection}}",
      targetLanguage: "Simplified Chinese"
    });
    const third = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A stable architecture",
      model: "model-b",
      selectionKind: "word",
      promptTemplate: "Explain {{selection}}",
      targetLanguage: "Simplified Chinese"
    });
    const fourth = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A stable architecture",
      model: "model-a",
      selectionKind: "text",
      promptTemplate: "Explain {{selection}}",
      targetLanguage: "Simplified Chinese"
    });
    const fifth = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A stable architecture",
      model: "model-a",
      selectionKind: "word",
      promptTemplate: "Translate {{selection}}",
      targetLanguage: "Simplified Chinese"
    });
    const sixth = await createExplanationCacheKey({
      selectedText: "architecture",
      context: "A stable architecture",
      model: "model-a",
      selectionKind: "word",
      promptTemplate: "Explain {{selection}}",
      targetLanguage: "English"
    });

    expect(first.cacheKey).toBe(second.cacheKey);
    expect(first.cacheKey).not.toBe(third.cacheKey);
    expect(first.cacheKey).not.toBe(fourth.cacheKey);
    expect(first.cacheKey).not.toBe(fifth.cacheKey);
    expect(first.cacheKey).not.toBe(sixth.cacheKey);
  });
});
