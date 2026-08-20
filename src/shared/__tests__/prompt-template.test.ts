import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  getDefaultPromptTemplate,
  getPromptTemplateForSelectionKind,
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
    expect(lookup).toContain("Selected Word:");
    expect(translation).toContain("Selected Content:");
    expect(lookup.indexOf("Requirements:")).toBeLessThan(
      lookup.indexOf("{{selection}}"),
    );
    expect(translation.indexOf("Requirements:")).toBeLessThan(
      translation.indexOf("{{selection}}"),
    );
  });

  it("provides separate Chinese defaults", () => {
    const lookup = getDefaultPromptTemplate("lookup", "zh-CN");
    const translation = getDefaultPromptTemplate("translation", "zh-CN");

    expect(lookup).toContain("当前含义");
    expect(translation).toContain("翻译");
    expect(lookup).not.toContain("{{task}}");
    expect(translation).not.toContain("{{task}}");
    expect(lookup).toContain("选中词语：");
    expect(translation).toContain("选中内容：");
    expect(lookup.indexOf("要求：")).toBeLessThan(
      lookup.indexOf("{{selection}}"),
    );
    expect(translation.indexOf("要求：")).toBeLessThan(
      translation.indexOf("{{selection}}"),
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
