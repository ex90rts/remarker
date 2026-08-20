import type { RuntimeMessage } from "./messages";

export const LLM_STREAM_PORT = "remarker-llm-stream";

export type LlmStreamStartMessage = {
  type: "start";
  requestId: string;
  payload: Extract<
    RuntimeMessage,
    { type: "EXPLAIN_SELECTION" | "ANALYZE_READING" }
  >;
};

export type LlmStreamClientMessage =
  | LlmStreamStartMessage
  | { type: "cancel"; requestId: string };

export type LlmStreamEvent =
  | { type: "started"; requestId: string }
  | { type: "chunk"; requestId: string; content: string }
  | { type: "completed"; requestId: string; result: import("./types").SelectionLookupResult }
  | { type: "analysis-completed"; requestId: string; result: import("./types").ReadingAnalysisRecord }
  | { type: "error"; requestId: string; error: string };

export class OpenAiSseParser {
  private buffer = "";

  push(chunk: string): { content: string[]; done: boolean } {
    const combined = this.buffer + chunk;
    const hasTrailingCarriageReturn = combined.endsWith("\r");
    const complete = hasTrailingCarriageReturn ? combined.slice(0, -1) : combined;
    this.buffer = complete.replace(/\r\n?/g, "\n") +
      (hasTrailingCarriageReturn ? "\r" : "");
    const frames = this.buffer.split("\n\n");
    this.buffer = frames.pop() ?? "";
    return parseFrames(frames);
  }

  finish(): { content: string[]; done: boolean } {
    const normalized = this.buffer.replace(/\r\n?/g, "\n");
    const frames = normalized.trim() ? [normalized] : [];
    this.buffer = "";
    return parseFrames(frames);
  }
}

function parseFrames(frames: string[]): { content: string[]; done: boolean } {
  const content: string[] = [];
  let done = false;
  for (const frame of frames) {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    if (data.trim() === "[DONE]") {
      done = true;
      continue;
    }
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
    };
    const value = json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content;
    if (value) content.push(value);
  }
  return { content, done };
}
