import { describe, expect, it } from "vitest";
import { OpenAiSseParser } from "../llm-stream";

describe("OpenAiSseParser", () => {
  it("parses frames split across transport chunks", () => {
    const parser = new OpenAiSseParser();
    expect(parser.push('data: {"choices":[{"delta":{"content":"Hel')).toEqual({
      content: [],
      done: false,
    });
    expect(parser.push('lo"}}]}\n\ndata: [DONE]\n\n')).toEqual({
      content: ["Hello"],
      done: true,
    });
  });

  it("supports CRLF and message content fallback", () => {
    const parser = new OpenAiSseParser();
    expect(
      parser.push('data: {"choices":[{"message":{"content":"Complete"}}]}\r\n\r\n'),
    ).toEqual({ content: ["Complete"], done: false });
  });

  it("keeps CRLF frame boundaries when the carriage return is split across chunks", () => {
    const parser = new OpenAiSseParser();
    expect(parser.push('data: {"choices":[{"delta":{"content":"A"}}]}\r')).toEqual({
      content: [],
      done: false,
    });
    expect(parser.push('\n\r\ndata: [DONE]\r\n\r\n')).toEqual({
      content: ["A"],
      done: true,
    });
  });

  it("rejects malformed JSON frames", () => {
    const parser = new OpenAiSseParser();
    expect(() => parser.push("data: {not-json}\n\n")).toThrow();
  });
});
