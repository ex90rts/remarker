import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  createDefaultLlmBusinessConfigs,
  getDefaultPromptTemplate,
  getEffectiveLlmBusinessConfig,
  getPromptTemplateForSelectionKind,
  isDefaultPromptTemplate,
  normalizeLlmBusinessConfig,
} from "../types";
import { normalizeSettings } from "../repositories/db";

describe("prompt templates", () => {
  it("provides defaults for every LLM purpose", () => {
    const lookup = getDefaultPromptTemplate("lookup", "en");
    const translation = getDefaultPromptTemplate("translation", "en");
    const analysis = getDefaultPromptTemplate("analysis", "en");
    const chunkAnalysis = getDefaultPromptTemplate("chunkAnalysis", "en");

    expect(lookup).not.toBe(translation);
    expect(analysis).not.toBe(lookup);
    expect(analysis).not.toBe(translation);
    expect(lookup).not.toContain("{{selection}}");
    expect(lookup).not.toContain("{{context}}");
    expect(translation).not.toContain("{{selection}}");
    expect(translation).not.toContain("{{context}}");
    expect(analysis).not.toContain("{{selection}}");
    expect(analysis).not.toContain("{{context}}");
    expect(analysis).toContain("reading-profile analyst");
    expect(analysis).not.toContain("输出语种");
    expect(chunkAnalysis).toContain("Language Chunks");
    expect(chunkAnalysis).toContain("at most 5 chunks");
    expect(chunkAnalysis).toContain("Simplified Chinese");
    expect(chunkAnalysis).toContain('"useCases"');
    expect(lookup).not.toContain("Selected Word:");
    expect(translation).not.toContain("Selected Content:");
    expect(lookup).toContain("Requirements:");
    expect(translation).toContain("Requirements:");
  });

  it("provides separate Chinese defaults", () => {
    const lookup = getDefaultPromptTemplate("lookup", "zh-CN");
    const translation = getDefaultPromptTemplate("translation", "zh-CN");
    const analysis = getDefaultPromptTemplate("analysis", "zh-CN");
    const chunkAnalysis = getDefaultPromptTemplate("chunkAnalysis", "zh-CN");

    expect(lookup).toContain("当前含义");
    expect(translation).toContain("翻译");
    expect(lookup).not.toContain("{{selection}}");
    expect(lookup).not.toContain("{{context}}");
    expect(translation).not.toContain("{{selection}}");
    expect(translation).not.toContain("{{context}}");
    expect(analysis).toContain("阅读画像分析师");
    expect(analysis).not.toContain("{{selection}}");
    expect(analysis).not.toContain("{{context}}");
    expect(analysis).not.toContain("输出语种");
    expect(chunkAnalysis).toContain("按照常用程度最多提取 5 个语块");
    expect(chunkAnalysis).toContain("直接返回 JSON");
    expect(chunkAnalysis).toContain('"useCases"');
    expect(lookup).not.toContain("选中词语：");
    expect(translation).not.toContain("选中内容：");
    expect(lookup).toContain("要求：");
    expect(translation).toContain("要求：");
  });

  it("recognizes both language versions as defaults and stores the English default initially", () => {
    expect(
      isDefaultPromptTemplate(
        "analysis",
        getDefaultPromptTemplate("analysis", "en"),
      ),
    ).toBe(true);
    expect(
      isDefaultPromptTemplate(
        "analysis",
        getDefaultPromptTemplate("analysis", "zh-CN"),
      ),
    ).toBe(true);
    expect(DEFAULT_SETTINGS.llm.analysisPromptTemplate).toBe(
      getDefaultPromptTemplate("analysis", "en"),
    );
    expect(getDefaultPromptTemplate("chunkAnalysis", "en")).not.toBe(
      getDefaultPromptTemplate("chunkAnalysis", "zh-CN"),
    );
    expect(
      isDefaultPromptTemplate(
        "chunkAnalysis",
        "你是一位知识丰富、熟悉流行表达的语言学专家，请从以下语句中分析语块（Language Chunks），使用列表格式分别列出“语块：表达含义/使用场景”，请使用 Markdown 格式返回。",
      ),
    ).toBe(true);
  });

  it("selects the prompt that matches the selection kind", () => {
    expect(
      getPromptTemplateForSelectionKind(DEFAULT_SETTINGS.llm, "word"),
    ).toBe(DEFAULT_SETTINGS.llm.lookupPromptTemplate);
    expect(
      getPromptTemplateForSelectionKind(DEFAULT_SETTINGS.llm, "text"),
    ).toBe(DEFAULT_SETTINGS.llm.translationPromptTemplate);
  });

  it("provides separate defaults for each LLM business", () => {
    const businesses = createDefaultLlmBusinessConfigs();

    expect(businesses.lookup).toEqual({
      model: "",
      temperature: 0.2,
      timeoutMs: 30000,
    });
    expect(businesses.translation).toEqual({
      model: "",
      temperature: 0.2,
      timeoutMs: 30000,
    });
    expect(businesses.analysis).toEqual({
      model: "",
      temperature: 0.5,
      timeoutMs: 30000,
    });
    expect(businesses.chunkAnalysis).toEqual({
      model: "",
      temperature: 0.2,
      timeoutMs: 30000,
    });
  });

  it("falls back to the general model unless a business model is configured", () => {
    const withGeneralModel = {
      ...DEFAULT_SETTINGS.llm,
      providers: {
        ...DEFAULT_SETTINGS.llm.providers,
        [DEFAULT_SETTINGS.llm.provider]: {
          ...DEFAULT_SETTINGS.llm.providers[DEFAULT_SETTINGS.llm.provider],
          model: "general-model",
        },
      },
    };

    expect(getEffectiveLlmBusinessConfig(withGeneralModel, "lookup").model).toBe(
      "general-model",
    );

    expect(
      getEffectiveLlmBusinessConfig(
        {
          ...withGeneralModel,
          businesses: {
            ...withGeneralModel.businesses,
            lookup: {
              ...withGeneralModel.businesses.lookup,
              model: "lookup-model",
            },
          },
        },
        "lookup",
      ).model,
    ).toBe("lookup-model");
  });

  it("normalizes invalid business sampling and timeout values", () => {
    expect(
      normalizeLlmBusinessConfig("analysis", {
        model: "analysis-model",
        temperature: 3,
        timeoutMs: 0,
      }),
    ).toEqual({
      model: "analysis-model",
      temperature: 0.5,
      timeoutMs: 30000,
    });
  });

  it("discards persisted chunk-analysis customizations", () => {
    const normalized = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ui: { ...DEFAULT_SETTINGS.ui, language: "zh-CN" },
      llm: {
        ...DEFAULT_SETTINGS.llm,
        businesses: {
          ...DEFAULT_SETTINGS.llm.businesses,
          chunkAnalysis: {
            model: "custom-chunk-model",
            temperature: 1.7,
            timeoutMs: 90000,
          },
        },
        chunkAnalysisPromptTemplate: "Return arbitrary Markdown.",
      },
    });

    expect(normalized.llm.businesses.chunkAnalysis).toEqual({
      model: "",
      temperature: 0.2,
      timeoutMs: 30000,
    });
    expect(normalized.llm.chunkAnalysisPromptTemplate).toBe(
      getDefaultPromptTemplate("chunkAnalysis", "zh-CN"),
    );
  });
});
