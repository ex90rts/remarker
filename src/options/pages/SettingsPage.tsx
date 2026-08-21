import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChevronDown,
  Download,
  FlaskConical,
  Info,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createBackupJson,
  createIncrementalBackupJson,
} from "../../shared/export";
import type { Messages } from "../../shared/i18n";
import { LANGUAGE_OPTIONS, interpolate } from "../../shared/i18n";
import type { ListAllDataResult } from "../../shared/messages";
import type {
  AppSettings,
  FootprintRecord,
  HighlightColor,
  HighlightRecord,
  LlmProviderConfig,
  PromptTemplateType,
  VocabularyRecord,
} from "../../shared/types";
import {
  LLM_PROVIDER_PRESETS,
  RECORDS_PAGE_SIZE_OPTIONS,
  getDefaultPromptTemplate,
  getEffectiveLlmConfig,
  getLlmProviderPreset,
  isDefaultPromptTemplate,
  normalizeLlmProvider,
  normalizeLlmProviderConfig,
  normalizeRecordsPageSize,
} from "../../shared/types";

import {
  HIGHLIGHT_COLOR_OPTIONS,
  HighlightColorPreview,
  LLM_TEST_ERROR_TOAST_DURATION_MS,
  PROMPT_TEMPLATE_KEYS,
  SettingsField,
  llmOnboardingShimmer,
} from "../components";
import type { Notify, RunAction } from "../types";
import {
  downloadFile,
  formatError,
  getMissingPromptVariables,
  sendMessage,
} from "../utils";

function getOnboardingCopy(language: AppSettings["ui"]["language"]) {
  const copies = {
    "zh-CN": {
      title: "开始使用 ReMarker",
      body: "ReMarker 的查词和翻译需要 LLM 支持，插件采用 BYOK 模式，本身不提供 API 服务，请先配置好你自己 LLM 提供商的 Base URL、API Key 和模型。网页划线、笔记和本地数据管理无需 LLM 支持，可直接使用。",
    },
    "zh-TW": {
      title: "開始使用 ReMarker",
      body: "ReMarker 的查詞與翻譯需要 LLM 支援。外掛採用 BYOK 模式，本身不提供 API 服務，請先設定好你自己的 LLM 供應商 Base URL、API Key 與模型。網頁標記、筆記與本機資料管理不需要 LLM 支援，可直接使用。",
    },
    en: {
      title: "Get started with ReMarker",
      body: "ReMarker requires LLM support for word lookup and translation. The extension uses a BYOK model and does not provide an API service itself. Configure the Base URL, API key, and model for your own LLM provider first. Web highlighting, notes, and local data management do not require an LLM and can be used immediately.",
    },
    es: {
      title: "Empieza con ReMarker",
      body: "ReMarker necesita un LLM para consultar palabras y traducir. La extensión utiliza el modelo BYOK y no proporciona ningún servicio de API. Configura primero la URL base, la clave API y el modelo de tu propio proveedor de LLM. El resaltado de páginas web, las notas y la gestión de datos locales no necesitan un LLM y se pueden usar directamente.",
    },
  } as const;
  return copies[language];
}

export function SettingsTab({
  settingsValue,
  getFullSnapshot,
  includeSensitive,
  setIncludeSensitive,
  runAction,
  notify,
  onChange,
  t,
}: {
  settingsValue: AppSettings;
  getFullSnapshot: () => Promise<ListAllDataResult>;
  includeSensitive: boolean;
  setIncludeSensitive: (value: boolean) => void;
  runAction: RunAction;
  notify: Notify;
  onChange: () => Promise<void>;
  t: Messages;
}) {
  const [settings, setSettings] = useState<AppSettings>(settingsValue);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [disabledSitesText, setDisabledSitesText] = useState("");
  const [promptTemplateError, setPromptTemplateError] = useState("");
  const [promptTemplateType, setPromptTemplateType] =
    useState<PromptTemplateType>("lookup");
  const [isTestingLlm, setIsTestingLlm] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const fetchingModelsRef = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(
    window.location.hash.includes("onboarding=1"),
  );

  useEffect(() => {
    chrome.storage.local
      .get(["globalEnabled", "disabledSites"])
      .then((cache) => {
        setGlobalEnabled(cache.globalEnabled ?? true);
        setDisabledSitesText(
          Array.isArray(cache.disabledSites)
            ? cache.disabledSites.join("\n")
            : "",
        );
      });
  }, []);

  async function savePreferences() {
    const language = settings.ui.language;
    const savedLlm = settingsValue.llm;
    await sendMessage({
      type: "SAVE_SETTINGS",
      settings: {
        ...settingsValue,
        llm: {
          ...savedLlm,
          lookupPromptTemplate: isDefaultPromptTemplate(
            "lookup",
            savedLlm.lookupPromptTemplate,
          )
            ? getDefaultPromptTemplate("lookup", language)
            : savedLlm.lookupPromptTemplate,
          translationPromptTemplate: isDefaultPromptTemplate(
            "translation",
            savedLlm.translationPromptTemplate,
          )
            ? getDefaultPromptTemplate("translation", language)
            : savedLlm.translationPromptTemplate,
          analysisPromptTemplate: isDefaultPromptTemplate(
            "analysis",
            savedLlm.analysisPromptTemplate,
          )
            ? getDefaultPromptTemplate("analysis", language)
            : savedLlm.analysisPromptTemplate,
        },
        ui: settings.ui,
      },
    });
    await chrome.storage.local.set({
      globalEnabled,
      disabledSites: disabledSitesText
        .split("\n")
        .map((site) => site.trim().toLowerCase())
        .filter(Boolean),
    });
    await onChange();
    notify(t.options.notices.settingsSaved);
  }

  async function saveLlmSettings() {
    if (!settings.llm.analysisPromptTemplate.trim()) {
      const message = t.options.errors.promptTemplateRequired;
      setPromptTemplateType("analysis");
      setPromptTemplateError(message);
      notify(message, "error");
      return;
    }

    const invalidPromptTemplate = (
      [
        ["lookup", settings.llm.lookupPromptTemplate],
        ["translation", settings.llm.translationPromptTemplate],
      ] as const
    ).find(([, template]) => getMissingPromptVariables(template).length > 0);
    if (invalidPromptTemplate) {
      const [type, template] = invalidPromptTemplate;
      const missingVariables = getMissingPromptVariables(template);
      const message = interpolate(
        t.options.errors.promptTemplateMissingVariables,
        {
          variables: missingVariables.join(", "),
        },
      );
      setPromptTemplateType(type);
      setPromptTemplateError(message);
      notify(message, "error");
      return;
    }

    setPromptTemplateError("");
    await sendMessage({
      type: "SAVE_SETTINGS",
      settings: { ...settingsValue, llm: settings.llm },
    });
    await onChange();
    notify(t.options.notices.settingsSaved);
  }

  async function importJson(file: File) {
    const text = await file.text();
    const parsed = JSON.parse(text) as {
      settings?: AppSettings;
      footprints?: FootprintRecord[];
      highlights?: HighlightRecord[];
      vocabulary?: VocabularyRecord[];
    };
    await sendMessage({ type: "IMPORT_SNAPSHOT", snapshot: parsed });
    await onChange();
    setSettings(await sendMessage<AppSettings>({ type: "GET_SETTINGS" }));
  }

  function updateLanguage(language: AppSettings["ui"]["language"]) {
    const shouldUpdateLookupPrompt = isDefaultPromptTemplate(
      "lookup",
      settings.llm.lookupPromptTemplate,
    );
    const shouldUpdateTranslationPrompt = isDefaultPromptTemplate(
      "translation",
      settings.llm.translationPromptTemplate,
    );
    const shouldUpdateAnalysisPrompt = isDefaultPromptTemplate(
      "analysis",
      settings.llm.analysisPromptTemplate,
    );
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        lookupPromptTemplate: shouldUpdateLookupPrompt
          ? getDefaultPromptTemplate("lookup", language)
          : settings.llm.lookupPromptTemplate,
        translationPromptTemplate: shouldUpdateTranslationPrompt
          ? getDefaultPromptTemplate("translation", language)
          : settings.llm.translationPromptTemplate,
        analysisPromptTemplate: shouldUpdateAnalysisPrompt
          ? getDefaultPromptTemplate("analysis", language)
          : settings.llm.analysisPromptTemplate,
      },
      ui: { ...settings.ui, language },
    });
  }

  function updateLlmProvider(providerValue: string) {
    const provider = normalizeLlmProvider(providerValue);
    setAvailableModels([]);
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        provider,
      },
    });
  }

  function updateActiveLlmProviderConfig(updates: Partial<LlmProviderConfig>) {
    const provider = settings.llm.provider;
    const currentConfig = normalizeLlmProviderConfig(
      provider,
      settings.llm.providers[provider],
    );
    if ("baseUrl" in updates || "apiKey" in updates) {
      setAvailableModels([]);
    }
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        providers: {
          ...settings.llm.providers,
          [provider]: normalizeLlmProviderConfig(provider, {
            ...currentConfig,
            ...updates,
          }),
        },
      },
    });
  }

  function restoreDefaultPromptTemplate() {
    setPromptTemplateError("");
    const promptTemplateKey = PROMPT_TEMPLATE_KEYS[promptTemplateType];
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        [promptTemplateKey]: getDefaultPromptTemplate(
          promptTemplateType,
          settings.ui.language,
        ),
      },
    });
    notify(t.options.notices.promptRestored);
  }

  async function testLlmConnection() {
    const llm = getEffectiveLlmConfig(settings.llm);
    const missingFields = [
      [llm.baseUrl, t.options.settings.baseUrl],
      [llm.apiKey, t.options.settings.apiKey],
      [llm.model, t.options.settings.model],
    ]
      .filter(([value]) => !value.trim())
      .map(([, label]) => label);

    if (missingFields.length > 0) {
      notify(
        interpolate(t.options.errors.llmConfigRequired, {
          fields: missingFields.join(", "),
        }),
        "error",
        LLM_TEST_ERROR_TOAST_DURATION_MS,
      );
      return;
    }

    setIsTestingLlm(true);
    try {
      await sendMessage({
        type: "TEST_LLM_CONNECTION",
        settings: { ...settingsValue, llm: settings.llm },
      });
      notify(t.options.notices.llmConnectionSucceeded);
    } catch (error) {
      notify(
        interpolate(t.options.errors.llmConnectionFailed, {
          reason: formatError(error),
        }),
        "error",
        LLM_TEST_ERROR_TOAST_DURATION_MS,
      );
    } finally {
      setIsTestingLlm(false);
    }
  }

  async function fetchLlmModels({ silent = false } = {}) {
    if (fetchingModelsRef.current) return;

    const llm = getEffectiveLlmConfig(settings.llm);
    const missingFields = [
      [llm.provider, t.options.settings.provider],
      [llm.baseUrl, t.options.settings.baseUrl],
      [llm.apiKey, t.options.settings.apiKey],
    ]
      .filter(([value]) => !value.trim())
      .map(([, label]) => label);

    if (missingFields.length > 0) {
      if (!silent) {
        notify(
          interpolate(t.options.errors.modelListConfigRequired, {
            fields: missingFields.join(", "),
          }),
          "error",
          LLM_TEST_ERROR_TOAST_DURATION_MS,
        );
      }
      return;
    }

    fetchingModelsRef.current = true;
    if (!silent) setIsFetchingModels(true);
    try {
      const models = await sendMessage<string[]>({
        type: "GET_LLM_MODELS",
        settings: { ...settingsValue, llm: settings.llm },
      });
      if (models.length === 0) {
        if (!silent) {
          notify(
            t.options.errors.modelListEmpty,
            "error",
            LLM_TEST_ERROR_TOAST_DURATION_MS,
          );
        }
        return;
      }
      setAvailableModels(models);
      if (!silent) {
        notify(
          interpolate(t.options.notices.modelsFetched, {
            count: String(models.length),
          }),
        );
      }
    } catch (error) {
      if (!silent) {
        notify(
          interpolate(t.options.errors.modelListFetchFailed, {
            reason: formatError(error),
          }),
          "error",
          LLM_TEST_ERROR_TOAST_DURATION_MS,
        );
      }
    } finally {
      fetchingModelsRef.current = false;
      if (!silent) setIsFetchingModels(false);
    }
  }

  const activeLlmProviderPreset = getLlmProviderPreset(settings.llm.provider);
  const activeLlmProviderConfig = normalizeLlmProviderConfig(
    settings.llm.provider,
    settings.llm.providers[settings.llm.provider],
  );
  const isCustomLlmProvider = settings.llm.provider === "custom";
  const promptTemplateKey = PROMPT_TEMPLATE_KEYS[promptTemplateType];
  const activePromptTemplate = settings.llm[promptTemplateKey];

  return (
    <Stack spacing={3} maxWidth={760}>
      {showOnboarding && (
        <Paper
          variant="outlined"
          sx={{
            position: "relative",
            p: 2.25,
            bgcolor: "#eff6ff",
            borderColor: "#93c5fd",
          }}
        >
          <Stack sx={{ pr: 4 }}>
            <Box>
              <Typography variant="h6">
                {getOnboardingCopy(settings.ui.language).title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {getOnboardingCopy(settings.ui.language).body}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label={t.common.cancel}
            onClick={() => setShowOnboarding(false)}
            sx={{ position: "absolute", top: "10px", right: "10px" }}
          >
            <X size={18} />
          </IconButton>
        </Paper>
      )}
      <Paper
        component="section"
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2 }}
      >
        <Stack spacing={3}>
          <Typography variant="h6">{t.options.settings.preferences}</Typography>
          <SettingsField
            label={t.options.settings.language}
            inputId="settings-language"
          >
            <TextField
              id="settings-language"
              select
              value={settings.ui.language}
              helperText={t.options.settings.languageHelp}
              onChange={(event) =>
                updateLanguage(
                  event.target.value as AppSettings["ui"]["language"],
                )
              }
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <MenuItem key={language.value} value={language.value}>
                  {language.label}
                </MenuItem>
              ))}
            </TextField>
          </SettingsField>
          <SettingsField
            label={t.options.settings.recordsPageSize}
            inputId="settings-page-size"
          >
            <TextField
              id="settings-page-size"
              select
              value={settings.ui.recordsPageSize}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  ui: {
                    ...settings.ui,
                    recordsPageSize: normalizeRecordsPageSize(
                      Number(event.target.value),
                    ),
                  },
                })
              }
            >
              {RECORDS_PAGE_SIZE_OPTIONS.map((pageSize) => (
                <MenuItem key={pageSize} value={pageSize}>
                  {pageSize}
                </MenuItem>
              ))}
            </TextField>
          </SettingsField>
          <SettingsField
            label={t.options.settings.defaultHighlightColor}
            inputId="settings-highlight-color"
          >
            <TextField
              id="settings-highlight-color"
              select
              value={settings.ui.defaultHighlightColor}
              slotProps={{
                select: {
                  renderValue: (value) => (
                    <HighlightColorPreview color={value as HighlightColor} />
                  ),
                },
              }}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  ui: {
                    ...settings.ui,
                    defaultHighlightColor: event.target
                      .value as AppSettings["ui"]["defaultHighlightColor"],
                  },
                })
              }
            >
              {HIGHLIGHT_COLOR_OPTIONS.map((color) => (
                <MenuItem key={color} value={color}>
                  <HighlightColorPreview color={color} />
                </MenuItem>
              ))}
            </TextField>
          </SettingsField>
          <SettingsField
            label={t.options.settings.disabledSites}
            inputId="settings-disabled-sites"
          >
            <TextField
              id="settings-disabled-sites"
              value={disabledSitesText}
              onChange={(event) => setDisabledSitesText(event.target.value)}
              multiline
              minRows={4}
              helperText={t.options.settings.disabledSitesHelp}
            />
          </SettingsField>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={() => void runAction(savePreferences)}
            >
              {t.options.actions.saveSettings}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2 }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6">{t.options.settings.llm}</Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.75 }}
            >
              {t.options.settings.llmCostNotice}
            </Typography>
          </Box>
          {showOnboarding && (
            <Paper
              variant="outlined"
              sx={{
                position: "relative",
                isolation: "isolate",
                overflow: "hidden",
                px: 2,
                py: 1.5,
                bgcolor: "#dbeafe",
                borderColor: "#60a5fa",
                boxShadow: "0 8px 24px rgba(37, 99, 235, 0.16)",
                color: "#1e3a8a",
                "&::after": {
                  position: "absolute",
                  zIndex: 0,
                  top: "-100%",
                  bottom: "-100%",
                  left: 0,
                  width: "24%",
                  content: '\"\"',
                  background:
                    "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)",
                  animation: `${llmOnboardingShimmer} 2.8s ease-in-out infinite`,
                  pointerEvents: "none",
                },
                "@media (prefers-reduced-motion: reduce)": {
                  "&::after": { display: "none" },
                },
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ position: "relative", zIndex: 1 }}
              >
                <Info size={18} aria-hidden="true" />
                <Typography variant="body2" fontWeight={700}>
                  {t.options.settings.llmOnboardingNotice}
                </Typography>
              </Stack>
            </Paper>
          )}
          <SettingsField
            label={t.options.settings.provider}
            inputId="settings-llm-provider"
          >
            <TextField
              id="settings-llm-provider"
              select
              value={settings.llm.provider}
              helperText={t.options.settings.providerHelp}
              onChange={(event) => updateLlmProvider(event.target.value)}
              SelectProps={{
                renderValue: (value) => {
                  const provider = normalizeLlmProvider(value);
                  const preset = getLlmProviderPreset(provider);
                  return provider === "custom"
                    ? t.options.settings.customProvider
                    : preset.label;
                },
              }}
            >
              {LLM_PROVIDER_PRESETS.map((preset) => (
                <MenuItem
                  key={preset.value}
                  value={preset.value}
                  sx={{ alignItems: "flex-start", py: 1 }}
                >
                  <Stack spacing={0.25}>
                    <Typography variant="body2">
                      {preset.value === "custom"
                        ? t.options.settings.customProvider
                        : preset.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ lineHeight: 1.35, whiteSpace: "normal" }}
                    >
                      {t.options.settings.providerDescriptions[preset.value]}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </TextField>
          </SettingsField>
          <SettingsField
            label={t.options.settings.baseUrl}
            inputId="settings-llm-base-url"
          >
            <TextField
              id="settings-llm-base-url"
              value={
                isCustomLlmProvider
                  ? activeLlmProviderConfig.baseUrl
                  : activeLlmProviderPreset.baseUrl
              }
              disabled={!isCustomLlmProvider}
              onChange={(event) =>
                updateActiveLlmProviderConfig({ baseUrl: event.target.value })
              }
            />
          </SettingsField>
          <SettingsField
            label={t.options.settings.apiKey}
            inputId="settings-llm-api-key"
          >
            <TextField
              id="settings-llm-api-key"
              type="password"
              value={activeLlmProviderConfig.apiKey}
              helperText={t.options.settings.apiKeyHelp}
              onChange={(event) =>
                updateActiveLlmProviderConfig({ apiKey: event.target.value })
              }
              onBlur={(event) => {
                if (
                  (event.relatedTarget as HTMLElement | null)?.id ===
                  "settings-fetch-models"
                ) {
                  return;
                }
                void fetchLlmModels({ silent: true });
              }}
            />
          </SettingsField>
          <SettingsField
            label={t.options.settings.model}
            inputId="settings-llm-model"
            labelAction={
              <Button
                id="settings-fetch-models"
                variant="text"
                size="small"
                disabled={isFetchingModels}
                onClick={() => void fetchLlmModels()}
                sx={{ minWidth: "auto", px: 0.5, py: 0 }}
              >
                {isFetchingModels
                  ? t.options.actions.fetchingModels
                  : t.options.actions.fetchModels}
              </Button>
            }
          >
            <Autocomplete
              freeSolo
              options={availableModels}
              value={activeLlmProviderConfig.model || null}
              inputValue={activeLlmProviderConfig.model}
              loading={isFetchingModels}
              loadingText={t.options.actions.fetchingModels}
              onChange={(_event, value) =>
                updateActiveLlmProviderConfig({ model: value ?? "" })
              }
              onInputChange={(_event, value) =>
                updateActiveLlmProviderConfig({ model: value })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  id="settings-llm-model"
                  inputProps={{
                    ...params.inputProps,
                    id: "settings-llm-model",
                  }}
                  helperText={t.options.settings.modelHelp}
                />
              )}
            />
          </SettingsField>
          <Accordion
            disableGutters
            elevation={0}
            slotProps={{ heading: { component: "h3" } }}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "8px !important",
              "&::before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ChevronDown size={18} />}
              aria-controls="settings-llm-advanced-content"
              id="settings-llm-advanced-header"
              sx={{ px: 2, minHeight: 48 }}
            >
              <Typography fontWeight={600} variant="body2">
                {t.options.settings.advanced}
              </Typography>
            </AccordionSummary>
            <AccordionDetails
              id="settings-llm-advanced-content"
              sx={{ px: 2, pt: 0.5, pb: 2 }}
            >
              <Stack spacing={2.5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
                  <Box sx={{ flex: 1 }}>
                    <SettingsField
                      label={t.options.settings.temperature}
                      inputId="settings-llm-temperature"
                    >
                      <TextField
                        id="settings-llm-temperature"
                        type="number"
                        value={settings.llm.temperature}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            llm: {
                              ...settings.llm,
                              temperature: Number(event.target.value),
                            },
                          })
                        }
                        fullWidth
                      />
                    </SettingsField>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <SettingsField
                      label={t.options.settings.timeoutMs}
                      inputId="settings-llm-timeout"
                    >
                      <TextField
                        id="settings-llm-timeout"
                        type="number"
                        value={settings.llm.timeoutMs}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            llm: {
                              ...settings.llm,
                              timeoutMs: Number(event.target.value),
                            },
                          })
                        }
                        fullWidth
                      />
                    </SettingsField>
                  </Box>
                </Stack>
                <Stack spacing={0}>
                  <Box sx={{ mb: "20px" }}>
                    <Tabs
                      value={promptTemplateType}
                      onChange={(_event, value: PromptTemplateType) => {
                        setPromptTemplateType(value);
                        setPromptTemplateError("");
                      }}
                      aria-label={t.options.settings.promptTemplateType}
                      sx={{
                        minHeight: 34,
                        borderBottom: "1px solid #e2e8f0",
                        "& .MuiTab-root": {
                          minWidth: 72,
                          minHeight: 34,
                          px: 1.5,
                          py: 0.5,
                          fontSize: "0.8rem",
                        },
                      }}
                    >
                      <Tab
                        value="lookup"
                        label={t.options.settings.promptTemplateTypes.lookup}
                      />
                      <Tab
                        value="translation"
                        label={
                          t.options.settings.promptTemplateTypes.translation
                        }
                      />
                      <Tab
                        value="analysis"
                        label={t.options.settings.promptTemplateTypes.analysis}
                      />
                    </Tabs>
                  </Box>
                  <SettingsField
                    label={t.options.settings.promptTemplate}
                    inputId="settings-prompt-template"
                  >
                    <TextField
                      id="settings-prompt-template"
                      value={activePromptTemplate}
                      onChange={(event) => {
                        setPromptTemplateError("");
                        setSettings({
                          ...settings,
                          llm: {
                            ...settings.llm,
                            [promptTemplateKey]: event.target.value,
                          },
                        });
                      }}
                      multiline
                      minRows={12}
                      error={Boolean(promptTemplateError)}
                    />
                  </SettingsField>
                  <Box
                    sx={{
                      pt: 0.75,
                      alignItems: "flex-start",
                      display: "flex",
                      gap: 1,
                      justifyContent: "space-between",
                      pl: 1.75,
                    }}
                  >
                    <Typography
                      variant="caption"
                      color={promptTemplateError ? "error" : "text.secondary"}
                      sx={{ flex: 1, minWidth: 0, pt: 0.25 }}
                    >
                      {promptTemplateError ||
                        (promptTemplateType === "analysis"
                          ? t.options.settings.analysisPromptTemplateHelp
                          : t.options.settings.promptTemplateHelp)}
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      onClick={restoreDefaultPromptTemplate}
                      sx={{ flexShrink: 0, minWidth: "auto", px: 0.75, py: 0 }}
                    >
                      {t.options.actions.restoreDefault}
                    </Button>
                  </Box>
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FlaskConical size={14} />}
              disabled={isTestingLlm}
              onClick={() => void testLlmConnection()}
            >
              {isTestingLlm
                ? t.options.actions.testing
                : t.options.actions.test}
            </Button>
            <Button
              variant="contained"
              onClick={() => void runAction(saveLlmSettings)}
            >
              {t.options.actions.saveSettings}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2 }}
      >
        <Stack spacing={3}>
          <Typography variant="h6">
            {t.options.settings.importExport}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={includeSensitive}
                onChange={(event) => setIncludeSensitive(event.target.checked)}
              />
            }
            label={t.options.settings.includeSensitiveConfig}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              startIcon={<Download size={16} />}
              onClick={() =>
                void runAction(async () => {
                  const data = await getFullSnapshot();
                  downloadFile(
                    "remarker-backup.json",
                    createBackupJson({
                      settings: data.settings,
                      footprints: data.footprints,
                      highlights: data.highlights,
                      vocabulary: data.vocabulary,
                      includeSensitive,
                    }),
                    "application/json",
                  );
                }, t.options.notices.jsonExported)
              }
            >
              {t.options.actions.exportJson}
            </Button>
            <Button
              startIcon={<Download size={16} />}
              onClick={() =>
                void runAction(async () => {
                  const data = await getFullSnapshot();
                  const exportedAt = new Date().toISOString();
                  downloadFile(
                    "remarker-incremental.json",
                    createIncrementalBackupJson({
                      settings: data.settings,
                      footprints: data.footprints,
                      highlights: data.highlights,
                      vocabulary: data.vocabulary,
                      since: data.settings.export.lastIncrementalExportAt,
                      exportedAt,
                      includeSensitive,
                    }),
                    "application/json",
                  );
                  await sendMessage({
                    type: "SAVE_SETTINGS",
                    settings: {
                      ...data.settings,
                      export: { lastIncrementalExportAt: exportedAt },
                    },
                  });
                  await onChange();
                }, t.options.notices.jsonExported)
              }
            >
              Incremental JSON
            </Button>
            <Button startIcon={<Upload size={16} />} component="label">
              {t.options.actions.importJson}
              <input
                hidden
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file)
                    void runAction(
                      () => importJson(file),
                      t.options.notices.jsonImported,
                    );
                  event.currentTarget.value = "";
                }}
              />
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
