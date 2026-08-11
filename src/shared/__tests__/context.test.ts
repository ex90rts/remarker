import { describe, expect, it } from "vitest";
import {
  createSemanticContext,
  DEFAULT_CONTEXT_CHAR_LIMIT,
  normalizeContextForStorage,
} from "../context";

function selectText(source: string, selectedText: string) {
  const selectionStart = source.indexOf(selectedText);
  if (selectionStart === -1) throw new Error("Selected text not found.");
  return {
    text: source,
    selectionStart,
    selectionEnd: selectionStart + selectedText.length,
  };
}

describe("createSemanticContext", () => {
  it("prioritizes the current sentence and following sentences before earlier context", () => {
    const source =
      "Previous context sentence. Current selected sentence. First following sentence. Second following sentence. Third following sentence.";

    const context = createSemanticContext({
      ...selectText(source, "selected"),
      maxLength: 95,
    });

    expect(context).toContain("Current selected sentence.");
    expect(context).toContain("First following sentence.");
    expect(context).toContain("Second following sentence.");
    expect(context).not.toContain("Previous context sentence.");
  });

  it("uses newline and full-width or half-width semicolons as semantic boundaries", () => {
    const source =
      "上一段应该可以独立。\n当前句包含 keyword；后一句使用分号。再后一句也可以。前一句较远。";

    const context = createSemanticContext({
      ...selectText(source, "keyword"),
      maxLength: 32,
    });

    expect(context).toContain("当前句包含 keyword；");
    expect(context).toContain("后一句使用分号。");
    expect(context).not.toContain("上一段应该可以独立。");
  });

  it("keeps long contexts within the default 500 character limit", () => {
    const longBefore = `${"Before sentence. ".repeat(40)}`;
    const longAfter = `${"After sentence. ".repeat(40)}`;
    const source = `${longBefore}Current keyword sentence. ${longAfter}`;

    const context = createSemanticContext({
      ...selectText(source, "keyword"),
    });

    expect(context.length).toBeLessThanOrEqual(DEFAULT_CONTEXT_CHAR_LIMIT);
    expect(context).toContain("keyword");
  });
});

describe("normalizeContextForStorage", () => {
  it("collapses whitespace-only lines into one blank line while preserving indentation", () => {
    const context =
      "GitNexus precomputes structure.\n\n  \n\n    \nflowchart TB\n    subgraph Traditional\n        direction TB";

    expect(normalizeContextForStorage(context)).toBe(
      "GitNexus precomputes structure.\n\nflowchart TB\n    subgraph Traditional\n        direction TB",
    );
  });

  it("normalizes line endings and common invisible layout characters", () => {
    expect(
      normalizeContextForStorage(
        "\ufeffFirst\u00a0line  \r\n\u200b\r\n\r\nSecond\u2028line\u00ad",
      ),
    ).toBe("First line\n\nSecond\nline");
  });

  it("preserves joiners that can carry meaning in non-Latin scripts", () => {
    expect(normalizeContextForStorage("a\u200cb\u200dc")).toBe(
      "a\u200cb\u200dc",
    );
  });
});
