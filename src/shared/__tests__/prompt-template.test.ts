import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getDefaultPromptTemplate,
  getPromptTemplateForSelectionKind,
  migrateLegacyPromptTemplate,
} from "../types";

describe("prompt templates", () => {
  it("provides separate lookup and translation defaults without task variables", () => {
    const lookup = getDefaultPromptTemplate("lookup", "en");
    const translation = getDefaultPromptTemplate("translation", "en");

    expect(lookup).not.toBe(translation);
    expect(lookup).toContain("{{selection}}");
    expect(lookup).toContain("{{context}}");
    expect(translation).toContain("{{selection}}");
    expect(translation).toContain("{{context}}");
    expect(lookup).not.toContain("{{task}}");
    expect(translation).not.toContain("{{task}}");
  });

  it("provides separate Chinese defaults", () => {
    const lookup = getDefaultPromptTemplate("lookup", "zh-CN");
    const translation = getDefaultPromptTemplate("translation", "zh-CN");

    expect(lookup).toContain("当前含义");
    expect(translation).toContain("翻译");
    expect(lookup).not.toContain("{{task}}");
    expect(translation).not.toContain("{{task}}");
  });

  it("migrates a legacy custom task variable for each prompt type", () => {
    const legacy = "Task: {{task}}\nSelection: {{selection}}\nContext: {{context}}";

    expect(migrateLegacyPromptTemplate("lookup", legacy, "en")).toContain(
      "Explain the selected word in context.",
    );
    expect(migrateLegacyPromptTemplate("translation", legacy, "en")).toContain(
      "Translate the selected text according to its context.",
    );
    expect(migrateLegacyPromptTemplate("lookup", legacy, "en")).not.toContain(
      "{{task}}",
    );
  });

  it("selects the prompt that matches the selection kind", () => {
    expect(
      getPromptTemplateForSelectionKind(DEFAULT_SETTINGS.llm, "word"),
    ).toBe(DEFAULT_SETTINGS.llm.lookupPromptTemplate);
    expect(
      getPromptTemplateForSelectionKind(DEFAULT_SETTINGS.llm, "text"),
    ).toBe(DEFAULT_SETTINGS.llm.translationPromptTemplate);
  });
});
