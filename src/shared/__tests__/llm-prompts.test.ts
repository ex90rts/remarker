import { describe, expect, it } from "vitest";
import {
  buildLanguageChunkAnalysisChatMessages,
  buildReadingAnalysisChatMessages,
  buildSelectionChatMessages,
} from "../llm-prompts";
import type { HighlightRecord } from "../types";

describe("buildSelectionChatMessages", () => {
  it("uses the configured prompt as system content and runtime data as user content", () => {
    expect(
      buildSelectionChatMessages({
        systemPrompt: "Explain the selected content precisely.",
        targetLanguage: "Simplified Chinese",
        selectedText: "architecture",
        context: "A stable architecture supports change.",
      }),
    ).toEqual([
      {
        role: "system",
        content: "Explain the selected content precisely.",
      },
      {
        role: "user",
        content:
          "选中内容：\narchitecture\n\n上下文：\nA stable architecture supports change.\n\n回复语种：Simplified Chinese",
      },
    ]);
  });

  it("assembles reading analysis through the same chat-message path", () => {
    const highlight: HighlightRecord = {
      id: "highlight-1",
      urlKey: "https://example.com/article",
      sourceUrl: "https://example.com/article",
      sourceTitle: "Example article",
      selectedText: "A useful passage",
      color: "yellow",
      anchor: {
        selectedText: "A useful passage",
        prefixText: "",
        suffixText: "",
        textStart: 0,
        textEnd: 16,
      },
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const messages = buildReadingAnalysisChatMessages({
      systemPrompt: "  Analyze reading preferences.  ",
      highlights: [highlight],
      language: "zh-CN",
    });

    expect(messages[0]).toEqual({
      role: "system",
      content: "Analyze reading preferences.",
    });
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("A useful passage");
    expect(messages[1].content).toContain("简体中文");
  });

  it("sends the chunk prompt as system content and only the highlight as user content", () => {
    expect(
      buildLanguageChunkAnalysisChatMessages({
        systemPrompt: "  Return language chunks as JSON.  ",
        selectedText: "  We need to iron out the details.  ",
      }),
    ).toEqual([
      { role: "system", content: "Return language chunks as JSON." },
      { role: "user", content: "We need to iron out the details." },
    ]);
  });
});
