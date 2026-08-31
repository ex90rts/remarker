import { describe, expect, it } from "vitest";
import {
  formatLanguageChunksAsMarkdown,
  normalizeLanguageChunkResponse,
  parseLanguageChunkItems,
  segmentTextByLanguageChunk,
} from "../language-chunks";

describe("language chunk JSON", () => {
  it("parses and trims valid language chunk items", () => {
    expect(
      parseLanguageChunkItems(`[
        {
          "chunk": " hold up ",
          "meaning": " 站得住脚的 ",
          "useCases": " 用于评价观点或证据 "
        }
      ]`),
    ).toEqual([
      {
        chunk: "hold up",
        meaning: "站得住脚的",
        useCases: "用于评价观点或证据",
      },
    ]);
  });

  it("accepts a fenced response but normalizes it to plain JSON", () => {
    expect(
      normalizeLanguageChunkResponse(
        '```json\n[{"chunk":"hold up","meaning":"成立","useCases":"用于评价论点"}]\n```',
      ),
    ).toBe(
      '[{"chunk":"hold up","meaning":"成立","useCases":"用于评价论点"}]',
    );
  });

  it("rejects malformed or incomplete items", () => {
    expect(parseLanguageChunkItems("not JSON")).toBeUndefined();
    expect(
      parseLanguageChunkItems('[{"chunk":"hold up","meaning":"成立"}]'),
    ).toBeUndefined();
    expect(() => normalizeLanguageChunkResponse("{}"))
      .toThrowError("expected JSON array");
  });

  it("keeps at most five items from an otherwise valid response", () => {
    const response = JSON.stringify(
      Array.from({ length: 6 }, (_, index) => ({
        chunk: `chunk ${index + 1}`,
        meaning: `含义 ${index + 1}`,
        useCases: `场景 ${index + 1}`,
      })),
    );

    expect(JSON.parse(normalizeLanguageChunkResponse(response))).toHaveLength(5);
  });

  it("formats JSON items as a two-level Markdown unordered list", () => {
    expect(
      formatLanguageChunksAsMarkdown(`[
        {
          "chunk": "hold up",
          "meaning": "站得住脚的",
          "useCases": "用于评价观点或证据"
        },
        {
          "chunk": "in practice",
          "meaning": "在实践中",
          "useCases": "用于对比理论与实际"
        }
      ]`),
    ).toBe([
      "- **hold up**",
      "  - Meaning: 站得住脚的",
      "  - Usage scenarios: 用于评价观点或证据",
      "- **in practice**",
      "  - Meaning: 在实践中",
      "  - Usage scenarios: 用于对比理论与实际",
    ].join("\n"));
  });

  it("preserves legacy Markdown language chunks", () => {
    expect(
      formatLanguageChunksAsMarkdown(
        "  - **a useful sentence**: an example  ",
      ),
    ).toBe("- **a useful sentence**: an example");
  });

  it("segments every matching chunk without changing source text", () => {
    const source = "Hold up here; this should still hold   up under scrutiny.";
    const segments = segmentTextByLanguageChunk(source, "hold up");

    expect(segments.filter((segment) => segment.isMatch)).toEqual([
      { text: "Hold up", isMatch: true },
      { text: "hold   up", isMatch: true },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe(source);
  });

  it("treats regex characters in a chunk as literal text", () => {
    expect(segmentTextByLanguageChunk("Use C++ when C+ is not enough.", "C++"))
      .toEqual([
        { text: "Use ", isMatch: false },
        { text: "C++", isMatch: true },
        { text: " when C+ is not enough.", isMatch: false },
      ]);
  });

  it("returns the original text when no chunk matches", () => {
    expect(segmentTextByLanguageChunk("Nothing to highlight.", "hold up"))
      .toEqual([{ text: "Nothing to highlight.", isMatch: false }]);
  });
});
