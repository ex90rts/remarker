import { describe, expect, it } from "vitest";
import { buildLlmModelsUrl, parseLlmModelIds } from "../llm-models";

describe("buildLlmModelsUrl", () => {
  it("appends the models path to a normalized base URL", () => {
    expect(buildLlmModelsUrl("https://api.example.com/v1/")).toBe(
      "https://api.example.com/v1/models",
    );
  });
});

describe("parseLlmModelIds", () => {
  it("returns sorted model IDs from an OpenAI-compatible response", () => {
    expect(
      parseLlmModelIds({
        data: [{ id: "model-z" }, { id: "model-a" }],
      }),
    ).toEqual(["model-a", "model-z"]);
  });

  it("drops blank, malformed, and duplicate model IDs", () => {
    expect(
      parseLlmModelIds({
        data: [
          { id: " model-a " },
          { id: "model-a" },
          { id: "" },
          {},
          null,
        ],
      }),
    ).toEqual(["model-a"]);
  });

  it("rejects responses without a data array", () => {
    expect(() => parseLlmModelIds({ models: [] })).toThrow(
      "invalid model list",
    );
  });
});
