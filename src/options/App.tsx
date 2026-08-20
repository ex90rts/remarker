import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormLabel,
  FormControlLabel,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import {
  Bug,
  Archive,
  NotebookText,
  SquarePen,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Download,
  FileText,
  FlaskConical,
  Github,
  Highlighter,
  Info,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  RotateCcw,
  Settings,
  Footprints,
  Star,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import {
  ACTIVITY_LEVEL_COLORS,
  buildDailyActivity,
  getActivityColor,
  getLocalDateKey,
} from "../shared/activity";
import type { DailyActivity } from "../shared/activity";
import {
  createBackupJson,
  createHighlightsMarkdownExport,
  createIncrementalBackupJson,
  createNotionHighlightsExport,
  createNotionTranslationExport,
  createNotionVocabularyExport,
  createObsidianTranslationExport,
  createObsidianVocabularyExport,
} from "../shared/export";
import {
  detectBrowserLanguage,
  getMessages,
  interpolate,
  LANGUAGE_OPTIONS,
} from "../shared/i18n";
import type { Messages } from "../shared/i18n";
import { markdownToSafeHtml } from "../shared/markdown";
import { playPronunciation } from "../shared/pronunciation";
import { READING_ANALYSIS_HISTORY_LIMIT } from "../shared/reading-analysis";
import { getTodayReviewProgress } from "../shared/review";
import type { TodayReviewProgress } from "../shared/review";
import {
  LLM_STREAM_PORT,
  type LlmStreamClientMessage,
  type LlmStreamEvent,
} from "../shared/llm-stream";
import type {
  DataQuery,
  ListAllDataResult,
  OptionsOverviewResult,
  QueryResult,
  RuntimeMessage,
} from "../shared/messages";
import {
  DEFAULT_RECORDS_PAGE_SIZE,
  LLM_PROVIDER_PRESETS,
  RECORDS_PAGE_SIZE_OPTIONS,
  getLlmProviderPreset,
  getEffectiveLlmConfig,
  getDefaultPromptTemplate,
  isDefaultPromptTemplate,
  normalizeLlmProviderConfig,
  normalizeLlmProvider,
  normalizeRecordsPageSize,
} from "../shared/types";
import { isSingleEnglishWord } from "../shared/word";
import type {
  AppSettings,
  FootprintListItem,
  FootprintRecord,
  HighlightColor,
  HighlightRecord,
  HighlightStatus,
  LlmProviderConfig,
  PromptTemplateType,
  ReadingAnalysisRecord,
  RecordsPageSize,
  VocabularyRecord,
} from "../shared/types";

type TabKey =
  | "footprints"
  | "highlights"
  | "vocabulary"
  | "translations"
  | "settings"
  | "about";
type ToastSeverity = "success" | "error";

const PROMPT_TEMPLATE_KEYS = {
  lookup: "lookupPromptTemplate",
  translation: "translationPromptTemplate",
  analysis: "analysisPromptTemplate",
} as const satisfies Record<
  PromptTemplateType,
  | "lookupPromptTemplate"
  | "translationPromptTemplate"
  | "analysisPromptTemplate"
>;

interface SourceFilterNavigation {
  tab: "highlights" | "vocabulary" | "translations";
  keyword: string;
  token: number;
}

interface ToastState {
  id: number;
  message: string;
  severity: ToastSeverity;
  durationMs?: number;
}

type Notify = (
  message: string,
  severity?: ToastSeverity,
  durationMs?: number,
) => void;
type RunAction = (
  action: () => Promise<void> | void,
  successMessage?: string,
) => Promise<void>;

const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#ffe66d",
  green: "#b7f7c2",
  blue: "#b8ddff",
  pink: "#ffc2d4",
  purple: "#d8c7ff",
};
const HIGHLIGHT_COLOR_OPTIONS = Object.keys(
  HIGHLIGHT_COLORS,
) as HighlightColor[];

function HighlightColorPreview({ color }: { color: HighlightColor }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        px: 0.5,
        borderRadius: "2px",
        bgcolor: HIGHLIGHT_COLORS[color],
        color: "#172033",
        lineHeight: 1.6,
      }}
    >
      {color}
    </Box>
  );
}

const REMARKER_GITHUB_URL = "https://github.com/ex90rts/remarker";
const REPORT_ISSUE_URL = "https://github.com/ex90rts/remarker/issues/new";
const TOAST_DURATION_MS = 1500;
const LLM_TEST_ERROR_TOAST_DURATION_MS = 3000;
const PROMPT_REQUIRED_VARIABLES = ["{{selection}}", "{{context}}"] as const;

const llmOnboardingShimmer = keyframes`
  0% {
    transform: translateX(-200%) skewX(-24deg);
  }
  55%, 100% {
    transform: translateX(600%) skewX(-24deg);
  }
`;

const twoLineClampSx = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const markdownBodySx = {
  "& p": { my: 1 },
  "& ul": { my: 1, pl: 3 },
  "& blockquote": {
    borderLeft: "3px solid #cbd5e1",
    m: 0,
    pl: 2,
    color: "text.secondary",
  },
  "& pre": { p: 1.5, bgcolor: "#f1f5f9", borderRadius: 1, overflow: "auto" },
  "& code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    bgcolor: "#f1f5f9",
    px: 0.5,
    borderRadius: 0.5,
  },
  "& table": {
    width: "100%",
    borderCollapse: "collapse",
    my: 1.25,
    display: "block",
    overflowX: "auto",
  },
  "& th, & td": {
    border: "1px solid #cbd5e1",
    px: 1,
    py: 0.75,
    textAlign: "left",
    verticalAlign: "top",
  },
  "& th": { bgcolor: "#f8fafc", fontWeight: 700 },
};

export function App() {
  const [tab, setTab] = useState<TabKey>(() => getInitialTab());
  const [vocabularyView, setVocabularyView] = useState<"reading" | "review">(
    () =>
      window.location.hash.startsWith("#vocabulary-review")
        ? "review"
        : "reading",
  );
  const [overview, setOverview] = useState<OptionsOverviewResult | undefined>();
  const [dataRevision, setDataRevision] = useState(0);
  const [toast, setToast] = useState<ToastState | undefined>();
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false);
  const [sourceFilterNavigation, setSourceFilterNavigation] = useState<
    SourceFilterNavigation | undefined
  >();
  const language = overview?.settings.ui.language ?? detectBrowserLanguage();
  const t = getMessages(language);
  const isNarrowSidebar = useMediaQuery("(max-width:1279.95px)");
  const sidebarCollapsed = manuallyCollapsed || isNarrowSidebar;

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const result = await sendMessage<OptionsOverviewResult>({
      type: "GET_OPTIONS_OVERVIEW",
    });
    setOverview(result);
    setDataRevision((revision) => revision + 1);
  }

  function getFullSnapshot(): Promise<ListAllDataResult> {
    return sendMessage<ListAllDataResult>({ type: "LIST_ALL_DATA" });
  }

  function notify(
    message: string,
    severity: ToastSeverity = "success",
    durationMs?: number,
  ) {
    setToast({ id: Date.now(), message, severity, durationMs });
  }

  async function runAction(
    action: () => Promise<void> | void,
    successMessage?: string,
  ) {
    try {
      await action();
      if (successMessage) notify(successMessage, "success");
    } catch (error) {
      notify(formatError(error), "error");
    }
  }

  function switchTab(nextTab: TabKey) {
    setTab(nextTab);
    if (nextTab === "vocabulary") setVocabularyView("reading");
    window.history.replaceState(null, "", `#${nextTab}`);
  }

  function switchVocabularyView(view: "reading" | "review") {
    setVocabularyView(view);
    window.history.replaceState(
      null,
      "",
      view === "review" ? "#vocabulary-review" : "#vocabulary",
    );
  }

  function openVocabularyReview() {
    setTab("vocabulary");
    setVocabularyView("review");
    window.history.replaceState(null, "", "#vocabulary-review");
  }

  function switchTabWithSourceFilter(
    nextTab: "highlights" | "vocabulary" | "translations",
    sourceTitle: string,
  ) {
    setSourceFilterNavigation({
      tab: nextTab,
      keyword: getSourceSearchKeyword(sourceTitle),
      token: Date.now(),
    });
    switchTab(nextTab);
  }

  const counts = overview?.counts ?? {
    footprints: 0,
    highlights: 0,
    vocabulary: 0,
    translations: 0,
  };
  const recordsPageSize =
    overview?.settings.ui.recordsPageSize ?? DEFAULT_RECORDS_PAGE_SIZE;
  const activeTabLabel = getTabLabel(tab, t);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: "background.default",
        flexDirection: "row",
      }}
    >
      <Box
        component="aside"
        sx={{
          width: sidebarCollapsed ? 76 : 244,
          flexShrink: 0,
          display: "flex",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
          height: "100vh",
          overflowY: "auto",
          flexDirection: "column",
          gap: 3,
          alignItems: "stretch",
          px: sidebarCollapsed ? 1.5 : 2.25,
          py: 2.5,
          borderRight: "1px solid #e4e9f2",
          bgcolor: "#ffffff",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={sidebarCollapsed ? "center" : "flex-start"}
          sx={{ flexShrink: 0, px: sidebarCollapsed ? 0 : 0.75 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              component="img"
              src="/icons/remarker-icon.svg"
              alt=""
              sx={{ width: 30, height: 30, borderRadius: "8px" }}
            />
            <Typography
              variant="h3"
              sx={{
                display: sidebarCollapsed ? "none" : "block",
                fontSize: "1.5rem",
                fontWeight: 800,
                fontFamily: 'system-ui, "Pingfang SC"',
                background:
                  "linear-gradient(100deg, #00319d 0%, #0042d3 28%, #d946ef 60%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {t.common.appName}
            </Typography>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            flex: 1,
            minWidth: 0,
            width: "100%",
          }}
        >
          <Tabs
            orientation="vertical"
            variant="scrollable"
            value={tab}
            onChange={(_, value: TabKey) => switchTab(value)}
            sx={{
              flex: 1,
              minWidth: 0,
              width: "100%",
              ".MuiTabs-flexContainerVertical": {
                flexDirection: "column",
                gap: 0.75,
              },
              ".MuiTabs-scroller": {
                overflowX: "hidden !important",
                overflowY: "hidden !important",
              },
              ".MuiTabs-indicator": { display: "none" },
              ".MuiTab-root": {
                minHeight: 40,
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                minWidth: 0,
                px: sidebarCollapsed ? 0 : 1.25,
                borderRadius: "7px",
                color: "#65728b",
                fontSize: "0.81rem",
                fontWeight: 650,
                textTransform: "none",
                "&.Mui-selected": {
                  bgcolor: "#eaf1ff",
                  color: "#215ac9",
                },
              },
              ".MuiTab-iconWrapper": { mr: sidebarCollapsed ? 0 : 1 },
            }}
          >
            <Tab
              value="footprints"
              icon={getSidebarTabIcon(
                <Footprints size={16} />,
                t.options.tabs.footprints,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.footprints}
              label={
                sidebarCollapsed ? undefined : (
                  <NavigationLabel
                    label={t.options.tabs.footprints}
                    count={counts.footprints}
                  />
                )
              }
            />
            <Tab
              value="highlights"
              icon={getSidebarTabIcon(
                <Highlighter size={16} />,
                t.options.tabs.highlights,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.highlights}
              label={
                sidebarCollapsed ? undefined : (
                  <NavigationLabel
                    label={t.options.tabs.highlights}
                    count={counts.highlights}
                  />
                )
              }
            />
            <Tab
              value="vocabulary"
              icon={getSidebarTabIcon(
                <NotebookText size={16} />,
                t.options.tabs.vocabulary,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.vocabulary}
              label={
                sidebarCollapsed ? undefined : (
                  <NavigationLabel
                    label={t.options.tabs.vocabulary}
                    count={counts.vocabulary}
                  />
                )
              }
            />
            <Tab
              value="translations"
              icon={getSidebarTabIcon(
                <Languages size={16} />,
                t.options.tabs.translations,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.translations}
              label={
                sidebarCollapsed ? undefined : (
                  <NavigationLabel
                    label={t.options.tabs.translations}
                    count={counts.translations}
                  />
                )
              }
            />
            <Tab
              value="settings"
              icon={getSidebarTabIcon(
                <Settings size={16} />,
                t.options.tabs.settings,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.settings}
              label={sidebarCollapsed ? undefined : t.options.tabs.settings}
            />
            <Tab
              value="about"
              icon={getSidebarTabIcon(
                <Info size={16} />,
                t.options.tabs.about,
                sidebarCollapsed,
              )}
              iconPosition="start"
              aria-label={t.options.tabs.about}
              label={sidebarCollapsed ? undefined : t.options.tabs.about}
            />
          </Tabs>

          <Stack spacing={0.75} sx={{ flexShrink: 0, px: 0.25 }}>
            <SidebarLink
              href={REMARKER_GITHUB_URL}
              icon={<Github size={16} />}
              label="GitHub"
              collapsed={sidebarCollapsed}
            />
            <SidebarLink
              href={REPORT_ISSUE_URL}
              icon={<Bug size={16} />}
              label={t.options.sidebar.reportIssue}
              collapsed={sidebarCollapsed}
            />
            {!isNarrowSidebar && (
              <SidebarAction
                icon={
                  sidebarCollapsed ? (
                    <PanelLeftOpen size={16} />
                  ) : (
                    <PanelLeftClose size={16} />
                  )
                }
                label={
                  sidebarCollapsed
                    ? t.options.sidebar.expand
                    : t.options.sidebar.collapse
                }
                collapsed={sidebarCollapsed}
                onClick={() => setManuallyCollapsed((collapsed) => !collapsed)}
              />
            )}
          </Stack>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{
          width: "100%",
          minWidth: 1048,
          maxWidth: 1440,
          margin: "0 auto",
          flex: 1,
          p: { xs: 2, md: 3.5 },
        }}
      >
        <Box sx={{ width: "100%", mx: "auto" }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2.25, px: 0.25 }}
          >
            <Box>
              <Typography variant="h4">{activeTabLabel}</Typography>
            </Box>
            {tab === "vocabulary" && (
              <Tabs
                value={vocabularyView}
                onChange={(_, value: "reading" | "review") =>
                  switchVocabularyView(value)
                }
                sx={{
                  minHeight: 32,
                  "& .MuiTabs-indicator": {
                    height: 2,
                    borderRadius: 1,
                  },
                  "& .MuiTab-root": {
                    minWidth: 72,
                    minHeight: 32,
                    px: 1.25,
                    py: 0.5,
                    fontSize: "0.8125rem",
                    lineHeight: 1.25,
                    textTransform: "none",
                  },
                }}
              >
                <Tab
                  value="reading"
                  label={getReviewCopy(language).readingView}
                />
                <Tab
                  value="review"
                  label={getReviewCopy(language).reviewView}
                />
              </Tabs>
            )}
          </Stack>
          {tab === "settings" && overview ? (
            <SettingsTab
              settingsValue={overview.settings}
              getFullSnapshot={getFullSnapshot}
              includeSensitive={includeSensitive}
              setIncludeSensitive={setIncludeSensitive}
              runAction={runAction}
              notify={notify}
              onChange={reload}
              t={t}
            />
          ) : (
            <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
              <Box p={{ xs: 1.5, md: 2.25 }} sx={{ overflowX: "auto" }}>
              {tab === "footprints" && (
                <FootprintsTab
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  getFullSnapshot={getFullSnapshot}
                  refreshRevision={dataRevision}
                  onOpenTabWithSourceFilter={switchTabWithSourceFilter}
                  onOpenVocabularyReview={openVocabularyReview}
                  runAction={runAction}
                  language={language}
                  t={t}
                />
              )}
              {tab === "highlights" && (
                <HighlightsTab
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  getFullSnapshot={getFullSnapshot}
                  refreshRevision={dataRevision}
                  runAction={runAction}
                  notify={notify}
                  sourceFilterNavigation={sourceFilterNavigation}
                  t={t}
                />
              )}
              {tab === "vocabulary" &&
                (vocabularyView === "reading" ? (
                  <VocabularyTab
                    selectionKind="word"
                    recordsPageSize={recordsPageSize}
                    onChange={reload}
                    getFullSnapshot={getFullSnapshot}
                    refreshRevision={dataRevision}
                    runAction={runAction}
                    notify={notify}
                    sourceFilterNavigation={sourceFilterNavigation}
                    t={t}
                  />
                ) : (
                  <VocabularyReviewView
                    language={language}
                    vocabularyCount={counts.vocabulary}
                    onChange={reload}
                  />
                ))}
              {tab === "translations" && (
                <VocabularyTab
                  selectionKind="text"
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  getFullSnapshot={getFullSnapshot}
                  refreshRevision={dataRevision}
                  runAction={runAction}
                  notify={notify}
                  sourceFilterNavigation={sourceFilterNavigation}
                  t={t}
                />
              )}
                {tab === "about" && <AboutTab t={t} />}
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
      <Toast toast={toast} onClose={() => setToast(undefined)} />
    </Box>
  );
}

function getSidebarTabIcon(
  icon: ReactElement,
  label: string,
  collapsed: boolean,
): ReactElement {
  if (!collapsed) return icon;

  return (
    <Tooltip title={label} placement="right">
      <Box component="span" sx={{ display: "inline-flex" }}>
        {icon}
      </Box>
    </Tooltip>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
}) {
  const button = (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      startIcon={icon}
      aria-label={label}
      sx={sidebarLinkSx(collapsed)}
    >
      {collapsed ? undefined : label}
    </Button>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function SidebarAction({
  icon,
  label,
  collapsed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  const button = (
    <Button
      startIcon={icon}
      aria-label={label}
      onClick={onClick}
      sx={sidebarLinkSx(collapsed)}
    >
      {collapsed ? undefined : label}
    </Button>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

function sidebarLinkSx(collapsed: boolean) {
  return {
    minWidth: collapsed ? 40 : 0,
    minHeight: 40,
    justifyContent: collapsed ? "center" : "flex-start",
    px: collapsed ? 0 : 1.25,
    color: "#65728b",
    fontSize: "0.81rem",
    fontWeight: 650,
    "&:hover": {
      bgcolor: "#f4f7fc",
      color: "#215ac9",
    },
    ".MuiButton-startIcon": {
      m: collapsed ? 0 : undefined,
      mr: collapsed ? 0 : 1,
    },
  };
}

function NavigationLabel({ label, count }: { label: string; count?: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: "flex",
        flex: 1,
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Box component="span">{label}</Box>
      {count !== undefined && (
        <Box
          component="span"
          sx={{
            minWidth: 20,
            px: 0.6,
            py: 0.1,
            borderRadius: "5px",
            bgcolor: "rgba(90, 111, 151, 0.12)",
            color: "inherit",
            fontSize: "0.69rem",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
}

function getTabLabel(tab: TabKey, t: Messages): string {
  const labels: Record<TabKey, string> = {
    footprints: t.options.tabs.footprints,
    highlights: t.options.tabs.highlights,
    vocabulary: t.options.tabs.vocabulary,
    translations: t.options.tabs.translations,
    settings: t.options.tabs.settings,
    about: t.options.tabs.about,
  };
  return labels[tab];
}

function getInitialTab(): TabKey {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0];
  if (hash === "vocabulary-review") return "vocabulary";
  return isTabKey(hash) ? hash : "footprints";
}

function isTabKey(value: string): value is TabKey {
  return [
    "footprints",
    "highlights",
    "vocabulary",
    "translations",
    "settings",
    "about",
  ].includes(value);
}

function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | undefined;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(
      onClose,
      toast.durationMs ?? TOAST_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isError = toast.severity === "error";

  return (
    <Box
      key={toast.id}
      role={isError ? "alert" : "status"}
      sx={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        maxWidth: "min(420px, calc(100vw - 32px))",
        px: 3.375,
        py: 2.25,
        borderRadius: 1,
        border: "1px solid",
        borderColor: isError ? "#fecdca" : "#abefc6",
        boxShadow: "0 18px 48px rgba(15, 23, 42, 0.24)",
        bgcolor: isError ? "#fef3f2" : "#ecfdf3",
        color: "text.primary",
        fontSize: 14,
        lineHeight: 1.45,
        overflowWrap: "anywhere",
      }}
    >
      <Box
        component="span"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: isError ? "#d92d20" : "#079455",
        }}
      >
        {isError ? (
          <X size={22} strokeWidth={2.6} />
        ) : (
          <Check size={22} strokeWidth={2.6} />
        )}
      </Box>
      <Box component="span">{toast.message}</Box>
    </Box>
  );
}

function SourceLink({
  href,
  label,
  truncate = true,
}: {
  href: string;
  label: string;
  truncate?: boolean;
}) {
  return (
    <Typography
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      variant="body2"
      title={label}
      sx={{
        ...(truncate
          ? twoLineClampSx
          : {
              display: "inline",
              overflow: "visible",
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }),
        color: "#00319d",
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {label}
    </Typography>
  );
}

function TableActionBar({
  filters,
  actions,
}: {
  filters: ReactNode;
  actions: ReactNode;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {filters}
        </Stack>
        <Stack
          direction="row"
          spacing={1}
          justifyContent={{ xs: "flex-start", md: "flex-end" }}
        >
          {actions}
        </Stack>
      </Stack>
      <Divider />
    </Stack>
  );
}

interface ExportDropdownOption {
  key: string;
  label: string;
  onSelect: () => Promise<void> | void;
}

function ExportDropdownButton({
  label,
  options,
}: {
  label: string;
  options: ExportDropdownOption[];
}) {
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const isOpen = Boolean(anchorElement);

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<FileText size={16} />}
        endIcon={<ChevronDown size={15} />}
        aria-haspopup="menu"
        aria-expanded={isOpen ? "true" : undefined}
        onClick={(event: MouseEvent<HTMLElement>) =>
          setAnchorElement(event.currentTarget)
        }
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchorElement}
        open={isOpen}
        onClose={() => setAnchorElement(null)}
        MenuListProps={{ "aria-label": label }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.key}
            sx={{ fontSize: "0.85rem" }}
            onClick={() => {
              setAnchorElement(null);
              void option.onSelect();
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface ActivityCalendarDay {
  date: Date;
  dateKey: string;
  isInRange: boolean;
}

function LearningActivityHeatmap({
  getFullSnapshot,
  refreshRevision,
  language,
  onOpenVocabularyReview,
  t,
}: {
  getFullSnapshot: () => Promise<ListAllDataResult>;
  refreshRevision: number;
  language: AppSettings["ui"]["language"];
  onOpenVocabularyReview: () => void;
  t: Messages;
}) {
  const [activity, setActivity] = useState<Record<string, DailyActivity>>({});
  const [reviewProgress, setReviewProgress] = useState<TodayReviewProgress>(
    EMPTY_REVIEW_PROGRESS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const columns = useMemo(
    () => createSixMonthActivityCalendar(new Date()),
    [refreshRevision],
  );
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(language, { month: "short" }),
    [language],
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [language],
  );

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    void getFullSnapshot()
      .then((snapshot) => {
        if (!isCurrent) return;
        setActivity(
          buildDailyActivity(snapshot.highlights, snapshot.vocabulary),
        );
        setReviewProgress(
          getTodayReviewProgress(snapshot.vocabulary, new Date().toISOString()),
        );
      })
      .catch(() => {
        if (isCurrent) {
          setActivity({});
          setReviewProgress(EMPTY_REVIEW_PROGRESS);
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [getFullSnapshot, refreshRevision]);

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={2}
      alignItems="stretch"
      sx={{ px: 0.5, pt: 0.25 }}
    >
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minWidth: 0,
          p: 2,
          boxShadow: "none",
          bgcolor: "#fbfcfe",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 1.25 }}
        >
          <Typography variant="h6">{t.options.activity.title}</Typography>
          <ActivityLegend t={t} />
        </Stack>
        <Box sx={{ pb: 0.25 }}>
          <Box
            role="img"
            aria-label={t.options.activity.title}
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gridTemplateRows: `20px repeat(${ACTIVITY_HEATMAP_ROWS}, auto)`,
              gridAutoFlow: "column",
              gap: `${ACTIVITY_HEATMAP_GAP}px`,
              width: "100%",
              opacity: isLoading ? 0.55 : 1,
              transition: "opacity 120ms ease",
            }}
          >
            {columns.map((column, columnIndex) => {
              const monthStart = column.find(
                (day) => day.isInRange && day.date.getDate() === 1,
              );
              return (
                <Fragment key={column[0].dateKey}>
                  {monthStart && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        gridColumn: `${columnIndex + 1} / span 6`,
                        gridRow: 1,
                        alignSelf: "start",
                        color: "text.secondary",
                        lineHeight: "16px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {monthFormatter.format(monthStart.date)}
                    </Typography>
                  )}
                  {column.map((day, dayIndex) => {
                    const dayActivity = activity[day.dateKey] ?? EMPTY_ACTIVITY;
                    const isMonthStart = day.date.getDate() === 1;
                    const tooltipContent = (
                      <Box sx={{ py: 0.25 }}>
                        <Typography
                          component="div"
                          variant="caption"
                          sx={{ color: "inherit", fontWeight: 700 }}
                        >
                          {interpolate(t.options.activity.daySummary, {
                            date: dayFormatter.format(day.date),
                            total: dayActivity.total,
                          })}
                        </Typography>
                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                          {[
                            interpolate(t.options.activity.highlightSummary, {
                              count: dayActivity.highlights,
                            }),
                            interpolate(t.options.activity.vocabularySummary, {
                              count: dayActivity.vocabulary,
                            }),
                            interpolate(t.options.activity.translationSummary, {
                              count: dayActivity.translations,
                            }),
                            interpolate(t.options.activity.reviewSummary, {
                              count: dayActivity.reviews ?? 0,
                            }),
                          ].map((summary) => (
                            <Typography
                              key={summary}
                              component="div"
                              variant="caption"
                              sx={{ color: "inherit", fontWeight: 700 }}
                            >
                              {`• ${summary}`}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    );
                    const cell = (
                      <Box
                        component="span"
                        sx={{
                          gridColumn: columnIndex + 1,
                          gridRow: dayIndex + 2,
                          width: "100%",
                          aspectRatio: "1 / 1",
                          borderRadius: "3px",
                          bgcolor: day.isInRange
                            ? getActivityColor(dayActivity.total)
                            : "transparent",
                          border: "1px solid",
                          borderColor: day.isInRange
                            ? isMonthStart
                              ? ACTIVITY_MONTH_START_BORDER_COLOR
                              : "rgba(27, 31, 36, 0.06)"
                            : "transparent",
                          boxSizing: "border-box",
                        }}
                      />
                    );
                    return day.isInRange ? (
                      <Tooltip
                        key={day.dateKey}
                        arrow
                        placement="top"
                        enterDelay={150}
                        title={tooltipContent}
                      >
                        {cell}
                      </Tooltip>
                    ) : (
                      <Box
                        key={day.dateKey}
                        component="span"
                        sx={{
                          gridColumn: columnIndex + 1,
                          gridRow: dayIndex + 2,
                          width: "100%",
                          aspectRatio: "1 / 1",
                        }}
                      />
                    );
                  })}
                </Fragment>
              );
            })}
          </Box>
        </Box>
      </Paper>
      <TodayReviewCard
        progress={reviewProgress}
        isLoading={isLoading}
        onOpenReview={onOpenVocabularyReview}
        t={t}
      />
    </Stack>
  );
}

function ActivityLegend({ t }: { t: Messages }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
      <Typography variant="caption" color="text.secondary">
        {t.options.activity.less}
      </Typography>
      {ACTIVITY_LEVEL_COLORS.map((color) => (
        <Box
          key={color}
          component="span"
          sx={{
            width: 14,
            height: 14,
            borderRadius: "3px",
            bgcolor: color,
            border: "1px solid rgba(27, 31, 36, 0.06)",
          }}
        />
      ))}
      <Typography variant="caption" color="text.secondary">
        {t.options.activity.more}
      </Typography>
    </Stack>
  );
}

const EMPTY_ACTIVITY: DailyActivity = {
  highlights: 0,
  vocabulary: 0,
  translations: 0,
  reviews: 0,
  total: 0,
};

const EMPTY_REVIEW_PROGRESS: TodayReviewProgress = {
  completed: 0,
  pending: 0,
  total: 0,
};

function TodayReviewCard({
  progress,
  isLoading,
  onOpenReview,
  t,
}: {
  progress: TodayReviewProgress;
  isLoading: boolean;
  onOpenReview: () => void;
  t: Messages;
}) {
  const percentage = progress.total
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;
  const isEmpty = !isLoading && progress.total === 0;
  const isCompleted =
    progress.total > 0 && progress.completed >= progress.total;
  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: "100%", md: 248 },
        flexShrink: 0,
        p: 2,
        boxShadow: "none",
        bgcolor: "#fbfcfe",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <Typography variant="h6">{t.options.activity.reviewTitle}</Typography>
      {isLoading ? (
        <Box aria-busy="true" sx={{ flex: 1 }} />
      ) : isEmpty ? (
        <Box
          role="status"
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            py: 1.5,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ lineHeight: 1.7 }}
          >
            {t.options.activity.reviewEmpty}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ my: 1.25 }}>
            <Typography
              component="div"
              sx={{
                color: "text.primary",
                fontSize: "1.9rem",
                fontWeight: 750,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {progress.completed}
              <Box
                component="span"
                sx={{
                  color: "text.secondary",
                  fontSize: "1rem",
                  fontWeight: 600,
                }}
              >
                {` / ${progress.total}`}
              </Box>
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {interpolate(t.options.activity.reviewProgress, {
                completed: progress.completed,
                total: progress.total,
              })}
            </Typography>
          </Box>
          <Box
            sx={{
              height: 6,
              overflow: "hidden",
              borderRadius: 999,
              bgcolor: ACTIVITY_LEVEL_COLORS[0],
            }}
          >
            <Box
              sx={{
                width: `${percentage}%`,
                height: "100%",
                borderRadius: "inherit",
                bgcolor: ACTIVITY_LEVEL_COLORS[3],
                transition: "width 160ms ease",
              }}
            />
          </Box>
          {isCompleted ? (
            <Box
              role="status"
              sx={{
                mt: 1.5,
                alignSelf: "flex-start",
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor: "#dafbe1",
                color: "#116329",
              }}
            >
              <Typography
                component="span"
                variant="body2"
                sx={{ color: "inherit", fontWeight: 700 }}
              >
                {t.options.activity.reviewCompleted}
              </Typography>
            </Box>
          ) : (
            <Button
              size="small"
              variant="contained"
              endIcon={<ChevronRight size={15} />}
              onClick={onOpenReview}
              sx={{ mt: 1.5, alignSelf: "flex-start" }}
            >
              {t.options.activity.startReview}
            </Button>
          )}
        </>
      )}
    </Paper>
  );
}

const ACTIVITY_HEATMAP_ROWS = 4;
const ACTIVITY_HEATMAP_GAP = 4;
const ACTIVITY_MONTH_START_BORDER_COLOR = "#0073ffff";

function createSixMonthActivityCalendar(now: Date): ActivityCalendarDay[][] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const columns: ActivityCalendarDay[][] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= today) {
    const column: ActivityCalendarDay[] = [];
    for (let dayIndex = 0; dayIndex < ACTIVITY_HEATMAP_ROWS; dayIndex += 1) {
      const date = new Date(cursor);
      column.push({
        date,
        dateKey: getLocalDateKey(date)!,
        isInRange: date >= rangeStart && date <= today,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(column);
  }
  return columns;
}

function FootprintsTab({
  recordsPageSize,
  onChange,
  getFullSnapshot,
  refreshRevision,
  onOpenTabWithSourceFilter,
  onOpenVocabularyReview,
  runAction,
  language,
  t,
}: {
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
  getFullSnapshot: () => Promise<ListAllDataResult>;
  refreshRevision: number;
  onOpenTabWithSourceFilter: (
    tab: "highlights" | "vocabulary",
    sourceTitle: string,
  ) => void;
  onOpenVocabularyReview: () => void;
  runAction: RunAction;
  language: AppSettings["ui"]["language"];
  t: Messages;
}) {
  const [titleFilter, setTitleFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [page, setPage] = useState(0);
  const query = useMemo<DataQuery>(
    () => ({
      page,
      pageSize: recordsPageSize,
      title: titleFilter,
      site: siteFilter,
      starredOnly,
    }),
    [page, recordsPageSize, siteFilter, starredOnly, titleFilter],
  );
  const { items: pageItems, total } = useRuntimeQuery<FootprintListItem>(
    "QUERY_FOOTPRINTS",
    query,
    refreshRevision,
  );
  const hasFilters = Boolean(titleFilter || siteFilter || starredOnly);

  useEffect(
    () => setPage(0),
    [recordsPageSize, siteFilter, starredOnly, titleFilter],
  );
  useValidServerPage(page, total, recordsPageSize, setPage);

  function resetFilters() {
    setTitleFilter("");
    setSiteFilter("");
    setStarredOnly(false);
  }

  return (
    <Stack spacing={1.5}>
      <LearningActivityHeatmap
        getFullSnapshot={getFullSnapshot}
        refreshRevision={refreshRevision}
        language={language}
        onOpenVocabularyReview={onOpenVocabularyReview}
        t={t}
      />
      <Divider />
      <TableActionBar
        filters={
          <>
            <TextField
              size="small"
              label={t.options.columns.pageTitle}
              value={titleFilter}
              onChange={(event) => setTitleFilter(event.target.value)}
            />
            <TextField
              size="small"
              label={t.options.columns.site}
              value={siteFilter}
              onChange={(event) => setSiteFilter(event.target.value)}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={starredOnly}
                  onChange={(event) => setStarredOnly(event.target.checked)}
                />
              }
              label={t.options.filters.starredOnly}
              sx={{ mx: 0.5 }}
            />
            <Button
              variant="outlined"
              startIcon={<RotateCcw size={16} />}
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              {t.options.filters.reset}
            </Button>
          </>
        }
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshCcw size={16} />}
            onClick={() =>
              void runAction(onChange, t.options.notices.dataRefreshed)
            }
          >
            {t.common.refresh}
          </Button>
        }
      />
      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: 320 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 100 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell>{t.options.columns.pageTitle}</TableCell>
            <TableCell>{t.options.columns.site}</TableCell>
            <TableCell>{t.options.columns.browsedAt}</TableCell>
            <TableCell>{t.options.columns.highlightCount}</TableCell>
            <TableCell>{t.options.columns.lookupCount}</TableCell>
            <TableCell align="center">{t.options.columns.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pageItems.length === 0 ? (
            <EmptyTableRow colSpan={6} message={t.options.empty.footprints} />
          ) : (
            pageItems.map((item) => (
              <TableRow
                key={item.urlKey}
                sx={item.starred ? { bgcolor: "#fffbea" } : undefined}
              >
                <TableCell sx={{ maxWidth: 320 }}>
                  <SourceLink
                    href={item.sourceUrl}
                    label={item.sourceTitle || item.sourceUrl}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {item.siteName || t.common.empty}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {formatCreatedAt(item.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <CountLink
                    value={item.highlightCount}
                    onClick={
                      item.highlightCount > 0
                        ? () =>
                            onOpenTabWithSourceFilter(
                              "highlights",
                              item.sourceTitle || item.sourceUrl,
                            )
                        : undefined
                    }
                  />
                </TableCell>
                <TableCell>
                  <CountLink
                    value={item.lookupCount}
                    onClick={
                      item.lookupCount > 0
                        ? () =>
                            onOpenTabWithSourceFilter(
                              "vocabulary",
                              item.sourceTitle || item.sourceUrl,
                            )
                        : undefined
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    aria-label={
                      item.starred
                        ? t.options.actions.unstarFootprint
                        : t.options.actions.starFootprint
                    }
                    title={
                      item.starred
                        ? t.options.actions.unstarFootprint
                        : t.options.actions.starFootprint
                    }
                    onClick={() =>
                      void runAction(
                        async () => {
                          await sendMessage({
                            type: "SET_FOOTPRINT_STAR",
                            urlKey: item.urlKey,
                            starred: !item.starred,
                          });
                          await onChange();
                        },
                        item.starred
                          ? t.options.notices.footprintUnstarred
                          : t.options.notices.footprintStarred,
                      )
                    }
                    sx={
                      item.starred
                        ? {
                            color: "#f59e0b",
                            bgcolor: "#fffbeb",
                            "&:hover": { bgcolor: "#fef3c7" },
                          }
                        : undefined
                    }
                  >
                    <Star
                      size={16}
                      fill={item.starred ? "currentColor" : "none"}
                    />
                  </IconButton>
                  <ConfirmArchiveIconButton
                    label={t.options.actions.archiveFootprint}
                    message={t.options.confirmations.archiveFootprint}
                    onConfirm={async () => {
                      await runAction(async () => {
                        await sendMessage({
                          type: "ARCHIVE_FOOTPRINT",
                          urlKey: item.urlKey,
                        });
                        await onChange();
                      }, t.options.notices.footprintArchived);
                    }}
                    t={t}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {total > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={total}
                page={page}
                recordsPageSize={recordsPageSize}
                onPageChange={setPage}
                colSpan={6}
              />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </Stack>
  );
}

function CountLink({
  value,
  onClick,
}: {
  value: number;
  onClick?: () => void;
}) {
  if (!onClick) {
    return <Typography variant="body2">{value}</Typography>;
  }

  return (
    <Button
      variant="text"
      size="small"
      onClick={onClick}
      sx={{
        minWidth: "auto",
        px: 0,
        py: 0,
        lineHeight: 1.2,
        textDecoration: "underline",
        textUnderlineOffset: "2px",
      }}
    >
      {value}
    </Button>
  );
}

function HighlightsTab({
  recordsPageSize,
  onChange,
  getFullSnapshot,
  refreshRevision,
  runAction,
  notify,
  sourceFilterNavigation,
  t,
}: {
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
  getFullSnapshot: () => Promise<ListAllDataResult>;
  refreshRevision: number;
  runAction: RunAction;
  notify: Notify;
  sourceFilterNavigation?: SourceFilterNavigation;
  t: Messages;
}) {
  const [textFilter, setTextFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [colorFilter, setColorFilter] = useState<HighlightColor | "">("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [page, setPage] = useState(0);
  const query = useMemo<DataQuery>(
    () => ({
      page,
      pageSize: recordsPageSize,
      word: textFilter,
      source: sourceFilter,
      color: colorFilter,
    }),
    [colorFilter, page, recordsPageSize, sourceFilter, textFilter],
  );
  const { items: pageItems, total } = useRuntimeQuery<HighlightRecord>(
    "QUERY_HIGHLIGHTS",
    query,
    refreshRevision,
  );
  const hasFilters = Boolean(textFilter || sourceFilter || colorFilter);

  useEffect(
    () => setPage(0),
    [colorFilter, recordsPageSize, sourceFilter, textFilter],
  );
  useValidServerPage(page, total, recordsPageSize, setPage);

  useEffect(() => {
    if (sourceFilterNavigation?.tab !== "highlights") return;
    setSourceFilter(sourceFilterNavigation.keyword);
  }, [sourceFilterNavigation]);

  function resetFilters() {
    setTextFilter("");
    setSourceFilter("");
    setColorFilter("");
  }

  async function getFilteredHighlights(): Promise<HighlightRecord[]> {
    const snapshot = await getFullSnapshot();
    return sortByCreatedAtDesc(
      snapshot.highlights.filter(
        (highlight) =>
          includesFuzzy(highlight.selectedText, textFilter) &&
          includesFuzzy(
            `${highlight.sourceTitle || ""} ${highlight.sourceUrl}`,
            sourceFilter,
          ) &&
          (!colorFilter || highlight.color === colorFilter),
      ),
    );
  }

  return (
    <Stack spacing={1.5}>
      <TableActionBar
        filters={
          <>
            <TextField
              size="small"
              label={t.options.columns.highlightedText}
              value={textFilter}
              onChange={(event) => setTextFilter(event.target.value)}
            />
            <TextField
              size="small"
              label={t.options.columns.source}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            />
            <TextField
              select
              size="small"
              label={t.options.columns.color}
              value={colorFilter}
              onChange={(event) =>
                setColorFilter(event.target.value as HighlightColor | "")
              }
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">{t.options.filters.allColors}</MenuItem>
              {(Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]).map(
                (color) => (
                  <MenuItem key={color} value={color}>
                    {color}
                  </MenuItem>
                ),
              )}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<RotateCcw size={16} />}
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              {t.options.filters.reset}
            </Button>
          </>
        }
        actions={
          <>
            <Button
              variant="contained"
              startIcon={<Sparkles size={16} />}
              onClick={() => setIsAnalysisOpen(true)}
            >
              {t.options.readingAnalysis.action}
            </Button>
            <ExportDropdownButton
              label={t.options.actions.export}
              options={[
                {
                  key: "obsidian-markdown",
                  label: "Obsidian Markdown",
                  onSelect: () =>
                    runAction(
                      async () =>
                        downloadFile(
                          "remarker-highlights.md",
                          createHighlightsMarkdownExport(
                            await getFilteredHighlights(),
                          ),
                          "text/markdown",
                        ),
                      t.options.notices.markdownExported,
                    ),
                },
                {
                  key: "notion-markdown",
                  label: "Notion Markdown",
                  onSelect: () =>
                    runAction(
                      async () =>
                        downloadFile(
                          "remarker-highlights-notion.md",
                          createNotionHighlightsExport(
                            await getFilteredHighlights(),
                          ),
                          "text/markdown",
                        ),
                      t.options.notices.markdownExported,
                    ),
                },
              ]}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshCcw size={16} />}
              onClick={() =>
                void runAction(onChange, t.options.notices.dataRefreshed)
              }
            >
              {t.common.refresh}
            </Button>
          </>
        }
      />
      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 360 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 104 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>{t.options.columns.highlightedText}</TableCell>
            <TableCell>{t.options.columns.source}</TableCell>
            <TableCell>{t.options.columns.status}</TableCell>
            <TableCell>{t.options.columns.color}</TableCell>
            <TableCell align="center">{t.options.columns.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pageItems.length === 0 ? (
            <EmptyTableRow colSpan={6} message={t.options.empty.highlights} />
          ) : (
            pageItems.map((highlight) => (
              <Fragment key={highlight.id}>
                <TableRow>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={
                        expandedRows[highlight.id]
                          ? t.options.actions.collapseHighlight
                          : t.options.actions.expandHighlight
                      }
                      onClick={() =>
                        setExpandedRows((rows) => ({
                          ...rows,
                          [highlight.id]: !rows[highlight.id],
                        }))
                      }
                    >
                      {expandedRows[highlight.id] ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography
                      component="div"
                      variant="body2"
                      sx={{
                        ...twoLineClampSx,
                        lineHeight: 1.25,
                        fontWeight: 500,
                        mb: "6px",
                      }}
                    >
                      {highlight.selectedText}
                    </Typography>
                    <Typography
                      component="div"
                      variant="caption"
                      color="text.secondary"
                    >
                      {t.common.created} {formatCreatedAt(highlight.createdAt)}
                      {highlight.note && (
                        <Tooltip
                          arrow
                          placement="top"
                          title={
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {highlight.note}
                            </Typography>
                          }
                        >
                          <Box
                            component="span"
                            tabIndex={0}
                            sx={{ cursor: "help", outlineOffset: 2 }}
                          >
                            {t.options.columns.hasNoteSuffix}
                          </Box>
                        </Tooltip>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 240, maxWidth: 240 }}>
                    <SourceLink
                      href={highlight.sourceUrl}
                      label={highlight.sourceTitle || highlight.sourceUrl}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={highlight.status}
                      title={getHighlightStatusDescription(highlight.status, t)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box
                      component="span"
                      title={highlight.color}
                      sx={{
                        display: "inline-block",
                        width: 22,
                        height: 22,
                        borderRadius: "6px",
                        border: "1px solid rgba(15, 23, 42, 0.16)",
                        bgcolor: HIGHLIGHT_COLORS[highlight.color],
                        verticalAlign: "middle",
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <CopyIconButton
                      label={t.options.actions.copyHighlightedText}
                      text={highlight.selectedText}
                      notify={notify}
                      t={t}
                    />
                    <ConfirmDeleteIconButton
                      label={t.options.actions.deleteHighlight}
                      message={t.options.confirmations.deleteHighlight}
                      onConfirm={async () => {
                        await runAction(async () => {
                          await sendMessage({
                            type: "DELETE_HIGHLIGHT",
                            id: highlight.id,
                          });
                          await onChange();
                        }, t.options.notices.highlightDeleted);
                      }}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    colSpan={6}
                    sx={{
                      py: 0,
                      borderBottom: expandedRows[highlight.id] ? undefined : 0,
                    }}
                  >
                    <Collapse
                      in={Boolean(expandedRows[highlight.id])}
                      timeout="auto"
                      unmountOnExit
                    >
                      <HighlightDetails
                        highlight={highlight}
                        onChange={onChange}
                        runAction={runAction}
                        t={t}
                      />
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))
          )}
        </TableBody>
        {total > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={total}
                page={page}
                recordsPageSize={recordsPageSize}
                onPageChange={setPage}
                colSpan={6}
              />
            </TableRow>
          </TableFooter>
        )}
      </Table>
      <ReadingAnalysisDialog
        open={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        notify={notify}
        runAction={runAction}
        t={t}
      />
    </Stack>
  );
}

function ReadingAnalysisDialog({
  open,
  onClose,
  notify,
  runAction,
  t,
}: {
  open: boolean;
  onClose: () => void;
  notify: Notify;
  runAction: RunAction;
  t: Messages;
}) {
  const [history, setHistory] = useState<ReadingAnalysisRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [streamedResult, setStreamedResult] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const activeStreamRef = useRef<{
    requestId: string;
    port: chrome.runtime.Port;
  } | undefined>(undefined);
  const hasLoadedForOpenRef = useRef(false);

  const cancelAnalysis = (resetUi = true) => {
    const activeStream = activeStreamRef.current;
    if (activeStream) {
      activeStreamRef.current = undefined;
      activeStream.port.postMessage({
        type: "cancel",
        requestId: activeStream.requestId,
      } satisfies LlmStreamClientMessage);
      activeStream.port.disconnect();
    }
    if (resetUi) {
      setIsAnalyzing(false);
      setStreamedResult("");
      setErrorMessage("");
    }
  };

  const loadHistory = async () => {
    setIsHistoryLoading(true);
    const records = await sendMessage<ReadingAnalysisRecord[]>({
      type: "GET_READING_ANALYSES",
    });
    setHistory(records);
    setSelectedId((currentId) =>
      currentId && records.some((record) => record.id === currentId)
        ? currentId
        : records[0]?.id,
    );
    setIsHistoryLoading(false);
  };

  const startAnalysis = () => {
    cancelAnalysis();
    const requestId = crypto.randomUUID();
    const port = chrome.runtime.connect({ name: LLM_STREAM_PORT });
    activeStreamRef.current = { requestId, port };
    setSelectedId(undefined);
    setStreamedResult("");
    setErrorMessage("");
    setIsAnalyzing(true);

    port.onMessage.addListener((event: LlmStreamEvent) => {
      if (event.requestId !== requestId) return;
      if (event.type === "chunk") {
        setStreamedResult((current) => current + event.content);
        return;
      }
      if (event.type === "analysis-completed") {
        activeStreamRef.current = undefined;
        setIsAnalyzing(false);
        setStreamedResult("");
        setHistory((records) =>
          [event.result, ...records.filter((record) => record.id !== event.result.id)]
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, READING_ANALYSIS_HISTORY_LIMIT),
        );
        setSelectedId(event.result.id);
        port.disconnect();
        return;
      }
      if (event.type === "error") {
        activeStreamRef.current = undefined;
        setIsAnalyzing(false);
        setErrorMessage(event.error);
        notify(
          interpolate(t.options.readingAnalysis.failed, { reason: event.error }),
          "error",
        );
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => {
      if (activeStreamRef.current?.requestId !== requestId) return;
      activeStreamRef.current = undefined;
      setIsAnalyzing(false);
      setErrorMessage(t.options.readingAnalysis.disconnected);
    });
    port.postMessage({
      type: "start",
      requestId,
      payload: { type: "ANALYZE_READING" },
    } satisfies LlmStreamClientMessage);
  };

  const deleteAnalysis = async (id: string) => {
    await runAction(async () => {
      await sendMessage({ type: "DELETE_READING_ANALYSIS", id });
      setHistory((records) => records.filter((record) => record.id !== id));
      setSelectedId((currentId) =>
        currentId === id
          ? history.find((record) => record.id !== id)?.id
          : currentId,
      );
    }, t.options.readingAnalysis.deleted);
  };

  useEffect(() => {
    if (!open) {
      hasLoadedForOpenRef.current = false;
      cancelAnalysis();
      return;
    }
    if (hasLoadedForOpenRef.current) return;
    hasLoadedForOpenRef.current = true;
    void loadHistory().catch((error: unknown) => {
      setIsHistoryLoading(false);
      notify(
        interpolate(t.options.readingAnalysis.failed, {
          reason: error instanceof Error ? error.message : String(error),
        }),
        "error",
      );
    });
  }, [open]);

  useEffect(() => () => cancelAnalysis(false), []);

  const selectedRecord = history.find((record) => record.id === selectedId);
  const displayedResult = selectedRecord?.result ?? streamedResult;

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason !== "backdropClick") onClose();
      }}
      fullWidth
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: 800,
            maxWidth: "calc(100vw - 32px)",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Sparkles size={19} />
        {t.options.readingAnalysis.title}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, overflow: "hidden" }}>
        {isHistoryLoading ? (
          <Box sx={{ height: 360, display: "grid", placeItems: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {t.options.readingAnalysis.loadingHistory}
            </Typography>
          </Box>
        ) : history.length === 0 && !isAnalyzing ? (
          <Stack
            spacing={2}
            alignItems="center"
            justifyContent="center"
            sx={{ height: 360, px: 3, textAlign: "center" }}
          >
            <Typography variant="body2" color="text.secondary">
              {t.options.readingAnalysis.emptyState}
            </Typography>
            <Button
              variant="contained"
              startIcon={<Sparkles size={16} />}
              onClick={startAnalysis}
            >
              {t.options.readingAnalysis.startAnalysis}
            </Button>
          </Stack>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "210px minmax(0, 1fr)",
              height: 500,
              maxHeight: "calc(100vh - 200px)",
              minHeight: 360,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                borderRight: "1px solid rgb(228, 233, 242)",
                overflow: "hidden",
                p: 1.25,
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 1 }}
              >
                {t.options.readingAnalysis.history}
              </Typography>
              <Stack spacing={0.5} mt={0.5}>
                {isAnalyzing && (
                  <Button
                    variant={!selectedId ? "contained" : "text"}
                    size="small"
                    startIcon={<Sparkles size={15} />}
                    onClick={() => setSelectedId(undefined)}
                    sx={{ justifyContent: "flex-start" }}
                  >
                    {t.options.readingAnalysis.analyzing}
                  </Button>
                )}
                {history.map((record) => (
                  <ReadingAnalysisHistoryItem
                    key={record.id}
                    record={record}
                    selected={selectedId === record.id}
                    onSelect={() => setSelectedId(record.id)}
                    onDelete={() => deleteAnalysis(record.id)}
                    t={t}
                  />
                ))}
              </Stack>
            </Box>
            <Box
              sx={{
                minHeight: 0,
                overflowX: "hidden",
                overflowY: "auto",
                p: 2.5,
              }}
              aria-live="polite"
            >
              {isAnalyzing && !displayedResult && (
                <Typography variant="body2" color="text.secondary">
                  {t.options.readingAnalysis.analyzing}
                </Typography>
              )}
              {errorMessage && (
                <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                  {errorMessage}
                </Typography>
              )}
              {selectedRecord && !isAnalyzing && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={1.5}
                >
                  {interpolate(t.options.readingAnalysis.generatedFrom, {
                    count: selectedRecord.highlightCount,
                  })}
                </Typography>
              )}
              {displayedResult && (
                <Box
                  className="markdown-body"
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    overflowWrap: "anywhere",
                    "& > :first-of-type": { mt: 0 },
                    "& > :last-child": { mb: 0 },
                  }}
                  dangerouslySetInnerHTML={{
                    __html: markdownToSafeHtml(displayedResult),
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {(history.length > 0 || isAnalyzing) && (
          <Button
            startIcon={<Sparkles size={16} />}
            disabled={isAnalyzing}
            onClick={startAnalysis}
          >
            {t.options.readingAnalysis.newAnalysis}
          </Button>
        )}
        <Button onClick={onClose}>{t.content.close}</Button>
      </DialogActions>
    </Dialog>
  );
}

function ReadingAnalysisHistoryItem({
  record,
  selected,
  onSelect,
  onDelete,
  t,
}: {
  record: ReadingAnalysisRecord;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
  t: Messages;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: "7px",
        bgcolor: selected ? "primary.main" : "transparent",
        color: selected ? "primary.contrastText" : "text.primary",
        transition: "background-color 120ms ease",
        "&:hover": {
          bgcolor: selected ? "primary.dark" : "action.hover",
        },
        "& .reading-analysis-delete-action": {
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 120ms ease",
        },
        "&:hover .reading-analysis-delete-action, &:focus-within .reading-analysis-delete-action": {
          opacity: 1,
          pointerEvents: "auto",
        },
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          minHeight: 34,
          px: 1,
          pr: 4.5,
          borderRadius: "inherit",
          cursor: "pointer",
          outline: 0,
          "&:focus-visible": {
            boxShadow: "0 0 0 2px rgba(39, 100, 220, 0.28)",
          },
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {formatCreatedAt(record.createdAt)}
        </Typography>
      </Box>
      <Box
        className="reading-analysis-delete-action"
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ConfirmPopover
          message={t.options.readingAnalysis.deleteConfirmation}
          onConfirm={onDelete}
          t={t}
        >
          {({ open }) => (
            <IconButton
              size="small"
              aria-label={t.options.readingAnalysis.deleteAnalysis}
              onClick={(event) => {
                event.stopPropagation();
                open(event);
              }}
              sx={{
                color: selected ? "inherit" : "error.main",
                "&:hover": {
                  bgcolor: selected
                    ? "rgba(255, 255, 255, 0.16)"
                    : "rgba(211, 47, 47, 0.08)",
                },
              }}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </ConfirmPopover>
      </Box>
    </Box>
  );
}

function HighlightDetails({
  highlight,
  onChange,
  runAction,
  t,
}: {
  highlight: HighlightRecord;
  onChange: () => Promise<void>;
  runAction: RunAction;
  t: Messages;
}) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(highlight.note ?? "");

  useEffect(() => {
    if (!isEditingNote) setNoteDraft(highlight.note ?? "");
  }, [highlight.note, isEditingNote]);

  async function saveNote() {
    await runAction(async () => {
      await sendMessage({
        type: "UPDATE_HIGHLIGHT_NOTE",
        id: highlight.id,
        note: noteDraft,
      });
      setIsEditingNote(false);
      await onChange();
    }, t.options.notices.highlightNoteSaved);
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        ml: 5,
        px: 2,
        py: 1.5,
        color: "text.primary",
      }}
    >
      <HighlightDetailLine label={t.options.columns.highlightedText}>
        <Box
          component="span"
          sx={{
            fontSize: "0.95rem",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {highlight.selectedText}
        </Box>
      </HighlightDetailLine>
      <Box>
        <Typography component="div" variant="body2">
          <Box component="b">{t.options.columns.note}</Box>:{" "}
          <Box
            component="span"
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {highlight.note || t.options.empty.note}
          </Box>
          <Tooltip
            arrow
            title={
              highlight.note
                ? t.options.actions.editHighlightNote
                : t.options.actions.addHighlightNote
            }
          >
            <SquarePen
              size={16}
              role="button"
              tabIndex={0}
              aria-label={
                highlight.note
                  ? t.options.actions.editHighlightNote
                  : t.options.actions.addHighlightNote
              }
              style={{
                cursor: "pointer",
                marginLeft: "6px",
                verticalAlign: "text-bottom",
              }}
              onClick={() => {
                setNoteDraft(highlight.note ?? "");
                setIsEditingNote(true);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setNoteDraft(highlight.note ?? "");
                setIsEditingNote(true);
              }}
            />
          </Tooltip>
        </Typography>
        {isEditingNote && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              multiline
              minRows={3}
              value={noteDraft}
              label={t.options.columns.note}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button
                size="small"
                onClick={() => {
                  setNoteDraft(highlight.note ?? "");
                  setIsEditingNote(false);
                }}
              >
                {t.common.cancel}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={() => void saveNote()}
              >
                {t.options.actions.saveHighlightNote}
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
      <HighlightDetailLine label={t.options.columns.source}>
        <SourceLink
          href={highlight.sourceUrl}
          label={highlight.sourceTitle || highlight.sourceUrl}
          truncate={false}
        />
      </HighlightDetailLine>
      <HighlightDetailLine label={t.common.created}>
        {formatCreatedAt(highlight.createdAt)}
      </HighlightDetailLine>
    </Box>
  );
}

function HighlightDetailLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Typography component="div" variant="body2">
      <Box component="b">{label}</Box>: {children}
    </Typography>
  );
}

function VocabularyTab({
  selectionKind,
  recordsPageSize,
  onChange,
  getFullSnapshot,
  refreshRevision,
  runAction,
  notify,
  sourceFilterNavigation,
  t,
}: {
  selectionKind: "word" | "text";
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
  getFullSnapshot: () => Promise<ListAllDataResult>;
  refreshRevision: number;
  runAction: RunAction;
  notify: Notify;
  sourceFilterNavigation?: SourceFilterNavigation;
  t: Messages;
}) {
  const isTranslation = selectionKind === "text";
  const recordLabel = isTranslation
    ? t.options.columns.original
    : t.options.columns.word;
  const [wordFilter, setWordFilter] = useState("");
  const [contextFilter, setContextFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(0);
  const query = useMemo<DataQuery>(
    () => ({
      page,
      pageSize: recordsPageSize,
      selectionKind,
      word: wordFilter,
      context: contextFilter,
      source: sourceFilter,
    }),
    [
      contextFilter,
      page,
      recordsPageSize,
      selectionKind,
      sourceFilter,
      wordFilter,
    ],
  );
  const { items: pageItems, total } = useRuntimeQuery<VocabularyRecord>(
    "QUERY_VOCABULARY",
    query,
    refreshRevision,
  );
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [editingTranslationId, setEditingTranslationId] = useState<string>();
  const [translationDraft, setTranslationDraft] = useState("");
  const hasFilters = Boolean(wordFilter || contextFilter || sourceFilter);

  async function saveTranslation(item: VocabularyRecord): Promise<void> {
    await runAction(async () => {
      await sendMessage({
        type: "UPDATE_VOCABULARY_TRANSLATION",
        id: item.id,
        translation: translationDraft,
      });
      setEditingTranslationId(undefined);
      await onChange();
    }, t.options.notices.explanationSaved);
  }

  useEffect(
    () => setPage(0),
    [contextFilter, recordsPageSize, selectionKind, sourceFilter, wordFilter],
  );
  useValidServerPage(page, total, recordsPageSize, setPage);

  useEffect(() => {
    const currentTab = isTranslation ? "translations" : "vocabulary";
    if (sourceFilterNavigation?.tab !== currentTab) return;
    setSourceFilter(sourceFilterNavigation.keyword);
  }, [sourceFilterNavigation]);

  function resetFilters() {
    setWordFilter("");
    setContextFilter("");
    setSourceFilter("");
  }

  async function getFilteredVocabulary(): Promise<VocabularyRecord[]> {
    const snapshot = await getFullSnapshot();
    return sortByCreatedAtDesc(
      snapshot.vocabulary.filter(
        (item) =>
          (item.selectionKind ?? "word") === selectionKind &&
          includesFuzzy(item.word, wordFilter) &&
          includesFuzzy(item.contextSentence, contextFilter) &&
          includesFuzzy(
            `${item.sourceTitle || ""} ${item.sourceUrl}`,
            sourceFilter,
          ),
      ),
    );
  }

  return (
    <Stack spacing={1.5}>
      <TableActionBar
        filters={
          <>
            <TextField
              size="small"
              label={recordLabel}
              value={wordFilter}
              onChange={(event) => setWordFilter(event.target.value)}
            />
            <TextField
              size="small"
              label={t.options.columns.context}
              value={contextFilter}
              onChange={(event) => setContextFilter(event.target.value)}
            />
            <TextField
              size="small"
              label={t.options.columns.source}
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            />
            <Button
              variant="outlined"
              startIcon={<RotateCcw size={16} />}
              disabled={!hasFilters}
              onClick={resetFilters}
            >
              {t.options.filters.reset}
            </Button>
          </>
        }
        actions={
          <>
            <ExportDropdownButton
              label={t.options.actions.export}
              options={[
                {
                  key: "obsidian-markdown",
                  label: "Obsidian Markdown",
                  onSelect: () =>
                    runAction(async () => {
                      const records = await getFilteredVocabulary();
                      downloadFile(
                        isTranslation
                          ? "remarker-translations.md"
                          : "remarker-new-words.md",
                        isTranslation
                          ? createObsidianTranslationExport(records)
                          : createObsidianVocabularyExport(records),
                        "text/markdown",
                      );
                    }, t.options.notices.markdownExported),
                },
                {
                  key: "notion-markdown",
                  label: "Notion Markdown",
                  onSelect: () =>
                    runAction(async () => {
                      const records = await getFilteredVocabulary();
                      downloadFile(
                        isTranslation
                          ? "remarker-translations-notion.md"
                          : "remarker-new-words-notion.md",
                        isTranslation
                          ? createNotionTranslationExport(records)
                          : createNotionVocabularyExport(records),
                        "text/markdown",
                      );
                    }, t.options.notices.markdownExported),
                },
              ]}
            />
            <Button
              variant="outlined"
              startIcon={<RefreshCcw size={16} />}
              onClick={() =>
                void runAction(onChange, t.options.notices.dataRefreshed)
              }
            >
              {t.common.refresh}
            </Button>
          </>
        }
      />
      <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: 48 }} />
          <col style={{ width: 260 }} />
          {!isTranslation && <col style={{ width: 72 }} />}
          <col style={{ width: 240 }} />
          <col style={{ width: 240 }} />
          <col style={{ width: 88 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>{recordLabel}</TableCell>
            {!isTranslation && <TableCell>{t.options.columns.audio}</TableCell>}
            <TableCell>{t.options.columns.context}</TableCell>
            <TableCell>{t.options.columns.source}</TableCell>
            <TableCell align="center">{t.options.columns.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pageItems.length === 0 ? (
            <EmptyTableRow
              colSpan={isTranslation ? 5 : 6}
              message={
                isTranslation
                  ? t.options.empty.translations
                  : t.options.empty.vocabulary
              }
            />
          ) : (
            pageItems.map((item) => (
              <Fragment key={item.id}>
                <TableRow>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={
                        expandedRows[item.id]
                          ? t.options.actions.collapseTranslation
                          : t.options.actions.expandTranslation
                      }
                      onClick={() =>
                        setExpandedRows((rows) => {
                          if (rows[item.id]) setEditingTranslationId(undefined);
                          return {
                            ...rows,
                            [item.id]: !rows[item.id],
                          };
                        })
                      }
                    >
                      {expandedRows[item.id] ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ width: 260 }}>
                    <Typography
                      component="div"
                      variant="body2"
                      fontWeight={600}
                      title={isTranslation ? item.word : undefined}
                      sx={
                        isTranslation
                          ? {
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }
                          : undefined
                      }
                    >
                      {item.word}
                    </Typography>
                    <Typography
                      component="div"
                      variant="caption"
                      color="text.secondary"
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {t.common.created} {formatCreatedAt(item.createdAt)}
                    </Typography>
                  </TableCell>
                  {!isTranslation && (
                    <TableCell>
                      {isSingleEnglishWord(item.word) && (
                        <IconButton
                          aria-label={interpolate(
                            t.options.actions.speakWord,
                            { word: item.word },
                          )}
                          onClick={() =>
                            void runAction(() => playPronunciation(item.word))
                          }
                        >
                          <Volume2 size={16} />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                  <TableCell sx={{ width: 240, maxWidth: 240 }}>
                    <Typography
                      component="div"
                      variant="body2"
                      title={item.contextSentence}
                      sx={twoLineClampSx}
                    >
                      {item.contextSentence}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 240, maxWidth: 240 }}>
                    <SourceLink
                      href={item.sourceUrl}
                      label={item.sourceTitle || item.sourceUrl}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <ConfirmDeleteIconButton
                      label={
                        isTranslation
                          ? t.options.actions.deleteTranslation
                          : t.options.actions.deleteVocabularyItem
                      }
                      message={
                        isTranslation
                          ? t.options.confirmations.deleteTranslation
                          : t.options.confirmations.deleteVocabularyItem
                      }
                      onConfirm={async () => {
                        await runAction(
                          async () => {
                            await sendMessage({
                              type: "DELETE_VOCABULARY",
                              id: item.id,
                            });
                            await onChange();
                          },
                          isTranslation
                            ? t.options.notices.translationDeleted
                            : t.options.notices.vocabularyDeleted,
                        );
                      }}
                      t={t}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell
                    colSpan={isTranslation ? 5 : 6}
                    sx={{
                      py: 0,
                      borderBottom: expandedRows[item.id] ? undefined : 0,
                    }}
                  >
                    <Collapse
                      in={Boolean(expandedRows[item.id])}
                      timeout="auto"
                      unmountOnExit
                    >
                      <Box sx={{ px: 2, py: 1.5, ml: 5 }}>
                        <Box
                          sx={{
                            bgcolor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: 1,
                            p: 1.5,
                            mb: 1.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            component="div"
                            sx={{ mb: 0.5 }}
                          >
                            {t.options.columns.context}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {renderHighlightedContext(
                              item.contextSentence || t.common.empty,
                              item.word,
                            )}
                          </Typography>
                        </Box>
                        {isTranslation && (
                          <Box
                            sx={{
                              bgcolor: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 1,
                              p: 1.5,
                              mb: 1.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              component="div"
                              sx={{ mb: 0.5 }}
                            >
                              {t.options.columns.original}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {item.word || t.common.empty}
                            </Typography>
                          </Box>
                        )}
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                          sx={{
                            mb: 0.5,
                            pb: 0.5,
                            borderBottom: "1px solid #dadada",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#000",
                              fontSize: "1em",
                              fontWeight: 700,
                            }}
                          >
                            {isTranslation
                              ? t.content.translation
                              : t.content.explanation}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              size="small"
                              aria-label={t.options.actions.editExplanation}
                              title={t.options.actions.editExplanation}
                              onClick={() => {
                                setTranslationDraft(item.translation || "");
                                setEditingTranslationId(item.id);
                              }}
                            >
                              <SquarePen size={16} />
                            </IconButton>
                            <CopyIconButton
                              label={t.options.actions.copyExplanation}
                              text={item.translation || ""}
                              notify={notify}
                              t={t}
                            />
                          </Stack>
                        </Stack>
                        {editingTranslationId === item.id ? (
                          <Stack spacing={1}>
                            <TextField
                              autoFocus
                              fullWidth
                              multiline
                              minRows={5}
                              value={translationDraft}
                              label={
                                isTranslation
                                  ? t.content.translation
                                  : t.content.explanation
                              }
                              onChange={(event) =>
                                setTranslationDraft(event.target.value)
                              }
                            />
                            <Stack
                              direction="row"
                              justifyContent="flex-end"
                              spacing={1}
                            >
                              <Button
                                size="small"
                                onClick={() =>
                                  setEditingTranslationId(undefined)
                                }
                              >
                                {t.common.cancel}
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => void saveTranslation(item)}
                              >
                                {t.options.actions.saveExplanation}
                              </Button>
                            </Stack>
                          </Stack>
                        ) : (
                          <Box
                            className="markdown-body"
                            sx={{
                              color: item.translation
                                ? "text.primary"
                                : "text.secondary",
                              fontSize: 14,
                              lineHeight: 1.65,
                              overflowWrap: "anywhere",
                              ...markdownBodySx,
                            }}
                            dangerouslySetInnerHTML={{
                              __html: markdownToSafeHtml(
                                item.translation || t.common.empty,
                              ),
                            }}
                          />
                        )}
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))
          )}
        </TableBody>
        {total > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={total}
                page={page}
                recordsPageSize={recordsPageSize}
                onPageChange={setPage}
                colSpan={isTranslation ? 5 : 6}
              />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </Stack>
  );
}

function VocabularyReviewView({
  language,
  vocabularyCount,
  onChange,
}: {
  language: AppSettings["ui"]["language"];
  vocabularyCount: number;
  onChange: () => Promise<void>;
}) {
  const copy = getReviewCopy(language);
  const [queue, setQueue] = useState<VocabularyRecord[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [explanationDraft, setExplanationDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dueCount, setDueCount] = useState(0);
  const [nextReviewAt, setNextReviewAt] = useState<string | undefined>();

  async function loadQueue() {
    setLoading(true);
    const now = new Date().toISOString();
    const [records, status] = await Promise.all([
      sendMessage<VocabularyRecord[]>({
        type: "GET_REVIEW_QUEUE",
        now,
        limit: 100,
      }),
      sendMessage<{ dueCount: number; nextReviewAt?: string }>({
        type: "GET_REVIEW_STATUS",
        now,
      }),
    ]);
    setQueue(records);
    setDueCount(status.dueCount);
    setNextReviewAt(status.nextReviewAt);
    setFlipped(false);
    setIsEditingExplanation(false);
    setExplanationDraft("");
    setLoading(false);
  }

  async function saveExplanation(): Promise<void> {
    const current = queue[0];
    if (!current) return;
    await sendMessage<VocabularyRecord>({
      type: "UPDATE_VOCABULARY_TRANSLATION",
      id: current.id,
      translation: explanationDraft,
    });
    setQueue((records) =>
      records.map((record) =>
        record.id === current.id
          ? { ...record, translation: explanationDraft }
          : record,
      ),
    );
    setIsEditingExplanation(false);
    await onChange();
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function submit(rating: "unfamiliar" | "hesitant" | "skilled") {
    const current = queue[0];
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await sendMessage<VocabularyRecord>({
        type: "SUBMIT_VOCABULARY_REVIEW",
        id: current.id,
        rating,
        reviewedAt: new Date().toISOString(),
      });
      setQueue((records) => records.slice(1));
      setDueCount((count) => Math.max(0, count - 1));
      setFlipped(false);
      setIsEditingExplanation(false);
      setExplanationDraft("");
      await onChange();
      if (queue.length === 1) await loadQueue();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Typography color="text.secondary">{copy.loading}</Typography>;
  }

  const current = queue[0];
  if (!current) {
    return (
      <Stack alignItems="center" spacing={1.5} sx={{ py: 8 }}>
        <Check size={34} color="#16a34a" />
        <Typography variant="h6">
          {vocabularyCount ? copy.completed : copy.noVocabulary}
        </Typography>
        <Typography color="text.secondary">
          {vocabularyCount && nextReviewAt
            ? `${copy.nextReview}: ${formatCreatedAt(nextReviewAt)}`
            : copy.lookupHint}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack alignItems="center" spacing={2.5} sx={{ py: 3 }}>
      <Typography color="text.secondary">
        {copy.dueCount.replace("{{count}}", String(dueCount))}
      </Typography>
      <Paper
        variant="outlined"
        role="button"
        tabIndex={0}
        onClick={() => setFlipped(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setFlipped(true);
        }}
        sx={{
          width: "min(680px, 100%)",
          minHeight: 330,
          p: 4,
          cursor: flipped ? "default" : "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography variant="h3" textAlign="center">
            {current.word}
          </Typography>
          {isSingleEnglishWord(current.word) && (
            <Button
              startIcon={<Volume2 size={16} />}
              onClick={(event) => {
                event.stopPropagation();
                void playPronunciation(current.word);
              }}
            >
              {copy.speak}
            </Button>
          )}
          {!flipped ? (
            <Typography color="text.secondary">{copy.flipHint}</Typography>
          ) : (
            <Stack spacing={2} width="100%">
              <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {copy.context}
                </Typography>
                <Typography>
                  {renderHighlightedContext(
                    current.contextSentence,
                    current.word,
                  )}
                </Typography>
              </Box>
              {isEditingExplanation ? (
                <Stack spacing={1} width="100%">
                  <TextField
                    autoFocus
                    fullWidth
                    multiline
                    minRows={5}
                    label={copy.explanation}
                    value={explanationDraft}
                    onChange={(event) =>
                      setExplanationDraft(event.target.value)
                    }
                    onClick={(event) => event.stopPropagation()}
                  />
                  <Stack direction="row" justifyContent="flex-end" spacing={1}>
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsEditingExplanation(false);
                      }}
                    >
                      {copy.cancel}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={submitting}
                      onClick={(event) => {
                        event.stopPropagation();
                        void saveExplanation();
                      }}
                    >
                      {copy.saveExplanation}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={0.75} width="100%">
                  <Stack direction="row" justifyContent="flex-end">
                    <IconButton
                      size="small"
                      aria-label={copy.editExplanation}
                      title={copy.editExplanation}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExplanationDraft(current.translation || "");
                        setIsEditingExplanation(true);
                      }}
                    >
                      <SquarePen size={16} />
                    </IconButton>
                  </Stack>
                  <Box
                    className="markdown-body"
                    sx={markdownBodySx}
                    dangerouslySetInnerHTML={{
                      __html: markdownToSafeHtml(current.translation || ""),
                    }}
                  />
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary">
                {current.sourceTitle || current.sourceUrl}
              </Typography>
            </Stack>
          )}
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1.5}>
        <Button
          variant="outlined"
          color="error"
          disabled={!flipped || submitting}
          onClick={() => void submit("unfamiliar")}
        >
          {copy.unfamiliar}
        </Button>
        <Button
          variant="outlined"
          color="warning"
          disabled={!flipped || submitting}
          onClick={() => void submit("hesitant")}
        >
          {copy.hesitant}
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!flipped || submitting}
          onClick={() => void submit("skilled")}
        >
          {copy.skilled}
        </Button>
      </Stack>
    </Stack>
  );
}

function getReviewCopy(language: AppSettings["ui"]["language"]) {
  const copies = {
    "zh-CN": {
      readingView: "阅读视图",
      reviewView: "复习视图",
      loading: "正在加载复习队列…",
      completed: "今天的复习已完成",
      noVocabulary: "还没有可复习的生词",
      nextReview: "下次复习",
      lookupHint: "去网页中查一个词，它会自动进入复习队列。",
      dueCount: "今日还有 {{count}} 个词待复习",
      flipHint: "点击卡片查看释义",
      context: "上下文",
      explanation: "解释",
      editExplanation: "编辑解释",
      saveExplanation: "保存解释",
      cancel: "取消",
      speak: "发音",
      unfamiliar: "生疏",
      hesitant: "犹豫",
      skilled: "熟练",
    },
    "zh-TW": {
      readingView: "閱讀檢視",
      reviewView: "複習檢視",
      loading: "正在載入複習佇列…",
      completed: "今天的複習已完成",
      noVocabulary: "還沒有可複習的生詞",
      nextReview: "下次複習",
      lookupHint: "到網頁中查一個詞，它會自動進入複習佇列。",
      dueCount: "今天還有 {{count}} 個詞待複習",
      flipHint: "點擊卡片查看解釋",
      context: "上下文",
      explanation: "解釋",
      editExplanation: "編輯解釋",
      saveExplanation: "儲存解釋",
      cancel: "取消",
      speak: "發音",
      unfamiliar: "生疏",
      hesitant: "猶豫",
      skilled: "熟練",
    },
    en: {
      readingView: "Reading",
      reviewView: "Review",
      loading: "Loading review queue…",
      completed: "Today's review is complete",
      noVocabulary: "No vocabulary to review yet",
      nextReview: "Next review",
      lookupHint:
        "Look up a word on a web page and it will enter the review queue.",
      dueCount: "{{count}} words due today",
      flipHint: "Click the card to reveal the explanation",
      context: "Context",
      explanation: "Explanation",
      editExplanation: "Edit explanation",
      saveExplanation: "Save explanation",
      cancel: "Cancel",
      speak: "Speak",
      unfamiliar: "Unfamiliar",
      hesitant: "Hesitant",
      skilled: "Skilled",
    },
    es: {
      readingView: "Lectura",
      reviewView: "Repaso",
      loading: "Cargando la cola de repaso…",
      completed: "El repaso de hoy está completo",
      noVocabulary: "Aún no hay vocabulario para repasar",
      nextReview: "Próximo repaso",
      lookupHint: "Busca una palabra en una página para añadirla al repaso.",
      dueCount: "Quedan {{count}} palabras para hoy",
      flipHint: "Haz clic para ver la explicación",
      context: "Contexto",
      explanation: "Explicación",
      editExplanation: "Editar explicación",
      saveExplanation: "Guardar explicación",
      cancel: "Cancelar",
      speak: "Pronunciar",
      unfamiliar: "Desconocida",
      hesitant: "Dudosa",
      skilled: "Dominada",
    },
  } as const;
  return copies[language] ?? copies.en;
}

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

function useRuntimeQuery<T>(
  type: "QUERY_FOOTPRINTS" | "QUERY_HIGHLIGHTS" | "QUERY_VOCABULARY",
  query: DataQuery,
  refreshRevision: number,
): QueryResult<T> {
  const [result, setResult] = useState<QueryResult<T>>({ items: [], total: 0 });
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let isCurrent = true;
    void sendMessage<QueryResult<T>>({ type, query }).then((next) => {
      if (isCurrent) setResult(next);
    });
    return () => {
      isCurrent = false;
    };
  }, [queryKey, refreshRevision, type]);

  return result;
}

function useValidServerPage(
  page: number,
  total: number,
  recordsPageSize: RecordsPageSize,
  setPage: (page: number) => void,
): void {
  const lastPage = Math.max(0, Math.ceil(total / recordsPageSize) - 1);
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [lastPage, page, setPage]);
}

function EmptyTableRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ py: 6 }}>
        <Stack alignItems="center" spacing={1.5}>
          <Typography color="text.secondary" variant="body2">
            {message}
          </Typography>
          <Button variant="outlined" size="small" onClick={openRandomArticle}>
            {getEmptyStateCta(detectBrowserLanguage())}
          </Button>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

function getEmptyStateCta(language: AppSettings["ui"]["language"]): string {
  return {
    "zh-CN": "去阅读一篇文章",
    "zh-TW": "去閱讀一篇文章",
    en: "Read an article",
    es: "Leer un artículo",
  }[language];
}

function openRandomArticle(): void {
  const language = detectBrowserLanguage();
  const subdomain =
    language === "zh-CN" || language === "zh-TW" ? "zh" : language;
  window.open(
    `https://${subdomain}.wikipedia.org/wiki/Special:Random`,
    "_blank",
    "noopener,noreferrer",
  );
}

function RecordsTablePagination({
  count,
  page,
  recordsPageSize,
  onPageChange,
  colSpan,
}: {
  count: number;
  page: number;
  recordsPageSize: RecordsPageSize;
  onPageChange: (page: number) => void;
  colSpan: number;
}) {
  return (
    <TablePagination
      rowsPerPageOptions={[recordsPageSize]}
      count={count}
      rowsPerPage={recordsPageSize}
      page={page}
      onPageChange={(_, nextPage) => onPageChange(nextPage)}
      colSpan={colSpan}
    />
  );
}

function AboutTab({ t }: { t: Messages }) {
  const releases = [
    {
      version: t.options.about.releases.v1_3.version,
      summary: t.options.about.releases.v1_3.summary,
      features: [
        t.options.about.releases.v1_3.feature1,
        t.options.about.releases.v1_3.feature2,
        t.options.about.releases.v1_3.feature3,
      ],
    },
    {
      version: t.options.about.releases.v1_2_1.version,
      summary: t.options.about.releases.v1_2_1.summary,
      features: [
        t.options.about.releases.v1_2_1.feature1,
        t.options.about.releases.v1_2_1.feature2,
        t.options.about.releases.v1_2_1.feature3,
      ],
    },
    {
      version: t.options.about.releases.v1_2.version,
      summary: t.options.about.releases.v1_2.summary,
      features: [
        t.options.about.releases.v1_2.feature1,
        t.options.about.releases.v1_2.feature2,
        t.options.about.releases.v1_2.feature3,
        t.options.about.releases.v1_2.feature4,
        t.options.about.releases.v1_2.feature5,
        t.options.about.releases.v1_2.feature6,
        t.options.about.releases.v1_2.feature7,
      ],
    },
    {
      version: t.options.about.releases.v1_1.version,
      summary: t.options.about.releases.v1_1.summary,
      features: [
        t.options.about.releases.v1_1.feature1,
        t.options.about.releases.v1_1.feature2,
      ],
    },
    {
      version: t.options.about.releases.v1_0.version,
      summary: t.options.about.releases.v1_0.summary,
      features: [
        t.options.about.releases.v1_0.feature1,
        t.options.about.releases.v1_0.feature2,
        t.options.about.releases.v1_0.feature3,
        t.options.about.releases.v1_0.feature4,
        t.options.about.releases.v1_0.feature5,
      ],
    },
  ];

  return (
    <Stack spacing={3} maxWidth={860}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t.options.about.releases.title}
        </Typography>
        <Stack spacing={2.5}>
          {releases.map((release) => (
            <Stack spacing={1} key={release.version}>
              <Typography variant="subtitle1" fontWeight={700}>
                {release.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {release.summary}
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                {release.features.map((feature) => (
                  <Typography
                    component="li"
                    variant="body2"
                    key={feature}
                    sx={{ mb: 0.75 }}
                  >
                    {feature}
                  </Typography>
                ))}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function CopyIconButton({
  label,
  text,
  notify,
  t,
}: {
  label: string;
  text: string;
  notify: Notify;
  t: Messages;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      notify(t.options.notices.copied);
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setIsCopied(false);
        timerRef.current = undefined;
      }, 1000);
    } catch (error) {
      notify(formatError(error), "error");
    }
  }

  return (
    <IconButton
      aria-label={isCopied ? t.common.copied : label}
      title={isCopied ? t.common.copied : label}
      onClick={copyText}
      sx={
        isCopied
          ? {
              color: "#067647",
              bgcolor: "#ecfdf3",
              "&:hover": { bgcolor: "#d1fadf" },
            }
          : undefined
      }
    >
      {isCopied ? <Check size={16} /> : <Copy size={16} />}
    </IconButton>
  );
}

function ConfirmDeleteIconButton({
  label,
  message,
  onConfirm,
  t,
}: {
  label: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  t: Messages;
}) {
  return (
    <ConfirmPopover message={message} onConfirm={onConfirm} t={t}>
      {({ open }) => (
        <IconButton aria-label={label} color="error" onClick={open}>
          <Trash2 size={16} />
        </IconButton>
      )}
    </ConfirmPopover>
  );
}

function ConfirmArchiveIconButton({
  label,
  message,
  onConfirm,
  t,
}: {
  label: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  t: Messages;
}) {
  return (
    <ConfirmPopover
      message={message}
      onConfirm={onConfirm}
      confirmLabel={t.common.archive}
      confirmColor="primary"
      t={t}
    >
      {({ open }) => (
        <IconButton aria-label={label} onClick={open}>
          <Archive size={16} />
        </IconButton>
      )}
    </ConfirmPopover>
  );
}

function ConfirmPopover({
  children,
  message,
  onConfirm,
  confirmLabel,
  confirmColor = "error",
  t,
}: {
  children: (props: {
    open: (event: MouseEvent<HTMLElement>) => void;
  }) => ReactNode;
  message: string;
  onConfirm: () => Promise<void> | void;
  confirmLabel?: string;
  confirmColor?: "error" | "primary";
  t: Messages;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    if (!isSubmitting) setAnchorEl(null);
  };

  return (
    <>
      {children({ open: (event) => setAnchorEl(event.currentTarget) })}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.25} sx={{ p: 1.5, maxWidth: 240 }}>
          <Typography variant="body2">{message}</Typography>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={close} disabled={isSubmitting}>
              {t.common.cancel}
            </Button>
            <Button
              size="small"
              color={confirmColor}
              variant="contained"
              disabled={isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await onConfirm();
                  setAnchorEl(null);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {confirmLabel ?? t.common.delete}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
}

function SettingsField({
  label,
  labelAction,
  inputId,
  children,
}: {
  label: ReactNode;
  labelAction?: ReactNode;
  inputId: string;
  children: ReactNode;
}) {
  return (
    <Stack spacing={0.875}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <FormLabel
          htmlFor={inputId}
          sx={{ color: "text.primary", fontSize: "0.875rem", fontWeight: 600 }}
        >
          {label}
        </FormLabel>
        {labelAction}
      </Stack>
      {children}
    </Stack>
  );
}

function SettingsTab({
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
      <Paper component="section" variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
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

      <Paper component="section" variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Box>
          <Typography variant="h6">{t.options.settings.llm}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
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
              label={t.options.settings.promptTemplateTypes.translation}
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
              {isTestingLlm ? t.options.actions.testing : t.options.actions.test}
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

      <Paper component="section" variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Stack spacing={3}>
          <Typography variant="h6">{t.options.settings.importExport}</Typography>
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

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getHighlightStatusDescription(
  status: HighlightStatus,
  t: Messages,
): string {
  switch (status) {
    case "active":
      return t.options.statusDescriptions.active;
    case "not_found":
      return t.options.statusDescriptions.not_found;
    case "ambiguous":
      return t.options.statusDescriptions.ambiguous;
    case "pending":
      return t.options.statusDescriptions.pending;
  }
}

function renderHighlightedContext(context: string, word: string): ReactNode {
  const target = word.trim();
  if (!target) return context;

  const lowerContext = context.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerContext.indexOf(lowerTarget);

  while (matchIndex !== -1) {
    const matchEnd = matchIndex + target.length;
    const isBoundaryMatch =
      isWordBoundary(context[matchIndex - 1]) &&
      isWordBoundary(context[matchEnd]);

    if (isBoundaryMatch) {
      if (matchIndex > cursor) nodes.push(context.slice(cursor, matchIndex));
      nodes.push(
        <Box
          key={`${matchIndex}-${matchEnd}`}
          component="mark"
          sx={{
            bgcolor: "#ffe66d",
            borderRadius: "3px",
            px: "2px",
            color: "inherit",
          }}
        >
          {context.slice(matchIndex, matchEnd)}
        </Box>,
      );
      cursor = matchEnd;
    }

    matchIndex = lowerContext.indexOf(
      lowerTarget,
      Math.max(matchIndex + 1, matchEnd),
    );
  }

  if (nodes.length === 0) return context;
  if (cursor < context.length) nodes.push(context.slice(cursor));
  return nodes;
}

function isWordBoundary(char: string | undefined): boolean {
  return !char || !/[A-Za-z0-9]/.test(char);
}

function includesFuzzy(value: string | undefined, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return (value ?? "").toLowerCase().includes(normalizedQuery);
}

function getSourceSearchKeyword(value: string): string {
  return value.trim().slice(0, 24);
}

function getMissingPromptVariables(promptTemplate: string): string[] {
  return PROMPT_REQUIRED_VARIABLES.filter(
    (variable) => !promptTemplate.includes(variable),
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Operation failed.";
}

function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime
    .sendMessage(message)
    .then((response: { ok: boolean; result?: T; error?: string }) => {
      if (!response?.ok)
        throw new Error(response?.error ?? "Extension request failed.");
      return response.result as T;
    });
}
