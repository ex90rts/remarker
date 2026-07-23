import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
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
import {
  Bug,
  Archive,
  NotebookText,
  ChevronDown,
  ChevronRight,
  Check,
  Copy,
  Download,
  FileText,
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
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import {
  createBackupJson,
  createHighlightsMarkdownExport,
  createTranslationMarkdownExport,
  createVocabularyMarkdownExport,
} from "../shared/export";
import {
  detectBrowserLanguage,
  getMessages,
  interpolate,
  LANGUAGE_OPTIONS,
} from "../shared/i18n";
import type { Messages } from "../shared/i18n";
import { markdownToSafeHtml } from "../shared/markdown";
import type {
  ListAllDataResult,
  PronunciationResult,
  RuntimeMessage,
} from "../shared/messages";
import {
  DEFAULT_RECORDS_PAGE_SIZE,
  LLM_PROVIDER_PRESETS,
  RECORDS_PAGE_SIZE_OPTIONS,
  getLlmProviderPreset,
  getDefaultPromptTemplate,
  isDefaultPromptTemplate,
  normalizeLlmProviderConfig,
  normalizeLlmProvider,
  normalizeRecordsPageSize,
} from "../shared/types";
import type {
  AppSettings,
  FootprintListItem,
  FootprintRecord,
  HighlightColor,
  HighlightRecord,
  HighlightStatus,
  LlmProviderConfig,
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

type Notify = (message: string, severity?: ToastSeverity) => void;
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

const REMARKER_GITHUB_URL = "https://github.com/ex90rts/remarker";
const REPORT_ISSUE_URL = "https://github.com/ex90rts/remarker/issues/new";
const TOAST_DURATION_MS = 1500;
const PROMPT_REQUIRED_VARIABLES = [
  "{{task}}",
  "{{selection}}",
  "{{context}}",
] as const;

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
  const [data, setData] = useState<ListAllDataResult | undefined>();
  const [toast, setToast] = useState<ToastState | undefined>();
  const [includeSensitive, setIncludeSensitive] = useState(false);
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false);
  const [sourceFilterNavigation, setSourceFilterNavigation] = useState<
    SourceFilterNavigation | undefined
  >();
  const language = data?.settings.ui.language ?? detectBrowserLanguage();
  const t = getMessages(language);
  const isNarrowSidebar = useMediaQuery("(max-width:1023.95px)");
  const sidebarCollapsed = manuallyCollapsed || isNarrowSidebar;

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    const result = await sendMessage<ListAllDataResult>({
      type: "LIST_ALL_DATA",
    });
    setData(result);
  }

  function notify(message: string, severity: ToastSeverity = "success") {
    setToast({ id: Date.now(), message, severity });
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
    window.history.replaceState(null, "", `#${nextTab}`);
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

  const counts = useMemo(
    () => ({
      footprints: data?.footprints.length ?? 0,
      highlights: data?.highlights.length ?? 0,
      vocabulary:
        data?.vocabulary.filter((item) => item.selectionKind !== "text")
          .length ?? 0,
      translations:
        data?.vocabulary.filter((item) => item.selectionKind === "text")
          .length ?? 0,
    }),
    [data],
  );
  const recordsPageSize =
    data?.settings.ui.recordsPageSize ?? DEFAULT_RECORDS_PAGE_SIZE;
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
              label="Report an issue"
              collapsed={sidebarCollapsed}
            />
            {!isNarrowSidebar && (
              <Tooltip
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                placement="right"
              >
                <IconButton
                  aria-label={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  onClick={() =>
                    setManuallyCollapsed((collapsed) => !collapsed)
                  }
                  sx={{
                    alignSelf: sidebarCollapsed ? "center" : "flex-start",
                    color: "#65728b",
                    "&:hover": { color: "#215ac9" },
                  }}
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen size={17} />
                  ) : (
                    <PanelLeftClose size={17} />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Box>

      <Box
        component="main"
        sx={{ minWidth: 1440, flex: 1, p: { xs: 2, md: 3.5 } }}
      >
        <Box sx={{ mx: "auto", maxWidth: 1280 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2.25, px: 0.25 }}
          >
            <Box>
              <Typography variant="h4">{activeTabLabel}</Typography>
            </Box>
          </Stack>
          <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
            <Box p={{ xs: 1.5, md: 2.25 }} sx={{ overflowX: "auto" }}>
              {tab === "footprints" && (
                <FootprintsTab
                  footprints={data?.footprints ?? []}
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  onOpenTabWithSourceFilter={switchTabWithSourceFilter}
                  runAction={runAction}
                  t={t}
                />
              )}
              {tab === "highlights" && (
                <HighlightsTab
                  highlights={data?.highlights ?? []}
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  runAction={runAction}
                  notify={notify}
                  sourceFilterNavigation={sourceFilterNavigation}
                  t={t}
                />
              )}
              {tab === "vocabulary" && (
                <VocabularyTab
                  vocabulary={data?.vocabulary ?? []}
                  selectionKind="word"
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  runAction={runAction}
                  notify={notify}
                  sourceFilterNavigation={sourceFilterNavigation}
                  t={t}
                />
              )}
              {tab === "translations" && (
                <VocabularyTab
                  vocabulary={data?.vocabulary ?? []}
                  selectionKind="text"
                  recordsPageSize={recordsPageSize}
                  onChange={reload}
                  runAction={runAction}
                  notify={notify}
                  sourceFilterNavigation={sourceFilterNavigation}
                  t={t}
                />
              )}
              {tab === "settings" && data && (
                <SettingsTab
                  data={data}
                  includeSensitive={includeSensitive}
                  setIncludeSensitive={setIncludeSensitive}
                  runAction={runAction}
                  notify={notify}
                  onChange={reload}
                  t={t}
                />
              )}
              {tab === "about" && <AboutTab t={t} />}
            </Box>
          </Paper>
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
  const hash = window.location.hash.replace(/^#/, "");
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

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <Typography
      component="a"
      href={href}
      target="_blank"
      rel="noreferrer"
      variant="body2"
      title={label}
      sx={{
        ...twoLineClampSx,
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

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function FootprintsTab({
  footprints,
  recordsPageSize,
  onChange,
  onOpenTabWithSourceFilter,
  runAction,
  t,
}: {
  footprints: FootprintListItem[];
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
  onOpenTabWithSourceFilter: (
    tab: "highlights" | "vocabulary",
    sourceTitle: string,
  ) => void;
  runAction: RunAction;
  t: Messages;
}) {
  const [titleFilter, setTitleFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const filteredFootprints = useMemo(
    () =>
      footprints.filter((item) => {
        const matchesTitle = includesFuzzy(item.sourceTitle, titleFilter);
        const matchesSite = includesFuzzy(item.siteName, siteFilter);
        const matchesStarred = !starredOnly || item.starred;
        return matchesTitle && matchesSite && matchesStarred;
      }),
    [footprints, siteFilter, starredOnly, titleFilter],
  );
  const { page, pageItems, setPage } = usePagedItems(
    filteredFootprints,
    recordsPageSize,
  );
  const hasFilters = Boolean(titleFilter || siteFilter || starredOnly);

  function resetFilters() {
    setTitleFilter("");
    setSiteFilter("");
    setStarredOnly(false);
  }

  return (
    <Stack spacing={1.5}>
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
          <col style={{ width: 190 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
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
        {filteredFootprints.length > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={filteredFootprints.length}
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
  highlights,
  recordsPageSize,
  onChange,
  runAction,
  notify,
  sourceFilterNavigation,
  t,
}: {
  highlights: HighlightRecord[];
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
  runAction: RunAction;
  notify: Notify;
  sourceFilterNavigation?: SourceFilterNavigation;
  t: Messages;
}) {
  const [textFilter, setTextFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [colorFilter, setColorFilter] = useState<HighlightColor | "">("");
  const filteredHighlights = useMemo(
    () =>
      highlights.filter((highlight) => {
        const matchesText = includesFuzzy(highlight.selectedText, textFilter);
        const matchesSource = includesFuzzy(
          `${highlight.sourceTitle || ""} ${highlight.sourceUrl}`,
          sourceFilter,
        );
        const matchesColor = !colorFilter || highlight.color === colorFilter;
        return matchesText && matchesSource && matchesColor;
      }),
    [colorFilter, highlights, sourceFilter, textFilter],
  );
  const sortedHighlights = useMemo(
    () => sortByCreatedAtDesc(filteredHighlights),
    [filteredHighlights],
  );
  const { page, pageItems, setPage } = usePagedItems(
    sortedHighlights,
    recordsPageSize,
  );
  const hasFilters = Boolean(textFilter || sourceFilter || colorFilter);

  useEffect(() => {
    if (sourceFilterNavigation?.tab !== "highlights") return;
    setSourceFilter(sourceFilterNavigation.keyword);
  }, [sourceFilterNavigation]);

  function resetFilters() {
    setTextFilter("");
    setSourceFilter("");
    setColorFilter("");
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
              variant="outlined"
              startIcon={<FileText size={16} />}
              onClick={() =>
                void runAction(
                  () =>
                    downloadFile(
                      "remarker-highlights.md",
                      createHighlightsMarkdownExport(sortedHighlights),
                      "text/markdown",
                    ),
                  t.options.notices.markdownExported,
                )
              }
            >
              {t.options.actions.export}
            </Button>
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
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t.options.columns.highlightedText}</TableCell>
            <TableCell>{t.options.columns.source}</TableCell>
            <TableCell>{t.options.columns.status}</TableCell>
            <TableCell>{t.options.columns.color}</TableCell>
            <TableCell align="center">{t.options.columns.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pageItems.length === 0 ? (
            <EmptyTableRow colSpan={5} message={t.options.empty.highlights} />
          ) : (
            pageItems.map((highlight) => (
              <TableRow key={highlight.id}>
                <TableCell sx={{ maxWidth: 420 }}>
                  <Typography component="div" variant="body2">
                    {highlight.selectedText}
                  </Typography>
                  <Typography
                    component="div"
                    variant="caption"
                    color="text.secondary"
                  >
                    {t.common.created} {formatCreatedAt(highlight.createdAt)}
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
            ))
          )}
        </TableBody>
        {sortedHighlights.length > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={sortedHighlights.length}
                page={page}
                recordsPageSize={recordsPageSize}
                onPageChange={setPage}
                colSpan={5}
              />
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </Stack>
  );
}

function VocabularyTab({
  vocabulary,
  selectionKind,
  recordsPageSize,
  onChange,
  runAction,
  notify,
  sourceFilterNavigation,
  t,
}: {
  vocabulary: VocabularyRecord[];
  selectionKind: "word" | "text";
  recordsPageSize: RecordsPageSize;
  onChange: () => Promise<void>;
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
  const filteredVocabulary = useMemo(
    () =>
      vocabulary.filter((item) => {
        if ((item.selectionKind ?? "word") !== selectionKind) return false;
        const matchesWord = includesFuzzy(item.word, wordFilter);
        const matchesContext = includesFuzzy(
          item.contextSentence,
          contextFilter,
        );
        const matchesSource = includesFuzzy(
          `${item.sourceTitle || ""} ${item.sourceUrl}`,
          sourceFilter,
        );
        return matchesWord && matchesContext && matchesSource;
      }),
    [contextFilter, selectionKind, sourceFilter, vocabulary, wordFilter],
  );
  const sortedVocabulary = useMemo(
    () => sortByCreatedAtDesc(filteredVocabulary),
    [filteredVocabulary],
  );
  const { page, pageItems, setPage } = usePagedItems(
    sortedVocabulary,
    recordsPageSize,
  );
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const hasFilters = Boolean(wordFilter || contextFilter || sourceFilter);

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
            <Button
              variant="outlined"
              startIcon={<FileText size={16} />}
              onClick={() =>
                void runAction(
                  () =>
                    downloadFile(
                      isTranslation
                        ? "remarker-translations.md"
                        : "remarker-new-words.md",
                      isTranslation
                        ? createTranslationMarkdownExport(sortedVocabulary)
                        : createVocabularyMarkdownExport(sortedVocabulary),
                      "text/markdown",
                    ),
                  t.options.notices.markdownExported,
                )
              }
            >
              {t.options.actions.export}
            </Button>
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
                        setExpandedRows((rows) => ({
                          ...rows,
                          [item.id]: !rows[item.id],
                        }))
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
                      <IconButton
                        aria-label={interpolate(t.options.actions.speakWord, {
                          word: item.word,
                        })}
                        onClick={() =>
                          void runAction(() => speakWord(item.word))
                        }
                      >
                        <Volume2 size={16} />
                      </IconButton>
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
                          <CopyIconButton
                            label={t.options.actions.copyExplanation}
                            text={item.translation || ""}
                            notify={notify}
                            t={t}
                          />
                        </Stack>
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
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))
          )}
        </TableBody>
        {sortedVocabulary.length > 0 && (
          <TableFooter>
            <TableRow>
              <RecordsTablePagination
                count={sortedVocabulary.length}
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

function usePagedItems<T>(items: T[], recordsPageSize: RecordsPageSize) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / recordsPageSize));
  const safePage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [items, recordsPageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return {
    page: safePage,
    pageItems: items.slice(
      safePage * recordsPageSize,
      safePage * recordsPageSize + recordsPageSize,
    ),
    setPage,
  };
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
        <Typography color="text.secondary" variant="body2">
          {message}
        </Typography>
      </TableCell>
    </TableRow>
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
  const releaseFeatures = [
    t.options.about.releases.feature1,
    t.options.about.releases.feature2,
    t.options.about.releases.feature3,
    t.options.about.releases.feature4,
    t.options.about.releases.feature5,
  ];

  return (
    <Stack spacing={3} maxWidth={860}>
      <Box>
        <Typography variant="h6" gutterBottom>
          {t.options.about.plan.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ maxWidth: 720 }}
        >
          {t.options.about.plan.body}
        </Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="h6" gutterBottom>
          {t.options.about.releases.title}
        </Typography>
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t.options.about.releases.version}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.options.about.releases.summary}
          </Typography>
          <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
            {releaseFeatures.map((feature) => (
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

function SettingsTab({
  data,
  includeSensitive,
  setIncludeSensitive,
  runAction,
  notify,
  onChange,
  t,
}: {
  data: ListAllDataResult;
  includeSensitive: boolean;
  setIncludeSensitive: (value: boolean) => void;
  runAction: RunAction;
  notify: Notify;
  onChange: () => Promise<void>;
  t: Messages;
}) {
  const [settings, setSettings] = useState<AppSettings>(data.settings);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [disabledSitesText, setDisabledSitesText] = useState("");
  const [promptTemplateError, setPromptTemplateError] = useState("");

  useEffect(() => setSettings(data.settings), [data.settings]);
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

  async function saveSettings() {
    const missingVariables = getMissingPromptVariables(
      settings.llm.promptTemplate,
    );
    if (missingVariables.length > 0) {
      const message = interpolate(
        t.options.errors.promptTemplateMissingVariables,
        {
          variables: missingVariables.join(", "),
        },
      );
      setPromptTemplateError(message);
      notify(message, "error");
      return;
    }

    setPromptTemplateError("");
    await sendMessage({ type: "SAVE_SETTINGS", settings });
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
  }

  function updateLanguage(language: AppSettings["ui"]["language"]) {
    const shouldUpdatePromptTemplate = isDefaultPromptTemplate(
      settings.llm.promptTemplate,
    );
    setSettings({
      ...settings,
      llm: shouldUpdatePromptTemplate
        ? {
            ...settings.llm,
            promptTemplate: getDefaultPromptTemplate(language),
          }
        : settings.llm,
      ui: { ...settings.ui, language },
    });
  }

  function updateLlmProvider(providerValue: string) {
    const provider = normalizeLlmProvider(providerValue);
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
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        promptTemplate: getDefaultPromptTemplate(settings.ui.language),
      },
    });
    notify(t.options.notices.promptRestored);
  }

  const activeLlmProviderPreset = getLlmProviderPreset(settings.llm.provider);
  const activeLlmProviderConfig = normalizeLlmProviderConfig(
    settings.llm.provider,
    settings.llm.providers[settings.llm.provider],
  );
  const isCustomLlmProvider = settings.llm.provider === "custom";

  return (
    <Stack spacing={3} maxWidth={760}>
      <Typography variant="h6">{t.options.settings.language}</Typography>
      <TextField
        select
        label={t.options.settings.language}
        value={settings.ui.language}
        helperText={t.options.settings.languageHelp}
        onChange={(event) =>
          updateLanguage(event.target.value as AppSettings["ui"]["language"])
        }
      >
        {LANGUAGE_OPTIONS.map((language) => (
          <MenuItem key={language.value} value={language.value}>
            {language.label}
          </MenuItem>
        ))}
      </TextField>

      <Box>
        <Typography variant="h6">{t.options.settings.llm}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {t.options.settings.llmCostNotice}
        </Typography>
      </Box>
      <TextField
        select
        label={t.options.settings.provider}
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
      <TextField
        label={t.options.settings.baseUrl}
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
      <TextField
        label={t.options.settings.apiKey}
        type="password"
        value={activeLlmProviderConfig.apiKey}
        helperText={t.options.settings.apiKeyHelp}
        onChange={(event) =>
          updateActiveLlmProviderConfig({ apiKey: event.target.value })
        }
      />
      <TextField
        label={t.options.settings.model}
        value={activeLlmProviderConfig.model}
        helperText={t.options.settings.modelHelp}
        onChange={(event) =>
          updateActiveLlmProviderConfig({ model: event.target.value })
        }
      />
      <Stack direction="row" spacing={2}>
        <TextField
          label={t.options.settings.temperature}
          type="number"
          value={settings.llm.temperature}
          onChange={(event) =>
            setSettings({
              ...settings,
              llm: { ...settings.llm, temperature: Number(event.target.value) },
            })
          }
        />
        <TextField
          label={t.options.settings.timeoutMs}
          type="number"
          value={settings.llm.timeoutMs}
          onChange={(event) =>
            setSettings({
              ...settings,
              llm: { ...settings.llm, timeoutMs: Number(event.target.value) },
            })
          }
        />
      </Stack>
      <Stack spacing={0.75}>
        <TextField
          label={t.options.settings.promptTemplate}
          value={settings.llm.promptTemplate}
          onChange={(event) => {
            setPromptTemplateError("");
            setSettings({
              ...settings,
              llm: { ...settings.llm, promptTemplate: event.target.value },
            });
          }}
          multiline
          minRows={12}
          error={Boolean(promptTemplateError)}
        />
        <Box
          sx={{
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
            {promptTemplateError || t.options.settings.promptTemplateHelp}
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

      <Typography variant="h6">{t.options.settings.pronunciation}</Typography>
      <TextField
        label={t.options.settings.merriamWebsterApiKey}
        type="password"
        value={settings.pronunciation.merriamWebsterApiKey}
        onChange={(event) =>
          setSettings({
            ...settings,
            pronunciation: {
              ...settings.pronunciation,
              merriamWebsterApiKey: event.target.value,
            },
          })
        }
      />

      <Typography variant="h6">{t.options.settings.preferences}</Typography>
      <Stack spacing={1.75}>
        <TextField
          select
          label={t.options.settings.recordsPageSize}
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
        <TextField
          select
          label={t.options.settings.defaultHighlightColor}
          value={settings.ui.defaultHighlightColor}
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
          {["yellow", "green", "blue", "pink", "purple"].map((color) => (
            <MenuItem key={color} value={color}>
              {color}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <TextField
        label={t.options.settings.disabledSites}
        value={disabledSitesText}
        onChange={(event) => setDisabledSitesText(event.target.value)}
        multiline
        minRows={4}
        helperText={t.options.settings.disabledSitesHelp}
      />
      <Button variant="contained" onClick={() => void runAction(saveSettings)}>
        {t.options.actions.saveSettings}
      </Button>

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
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button
          startIcon={<Download size={16} />}
          onClick={() =>
            void runAction(
              () =>
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
                ),
              t.options.notices.jsonExported,
            )
          }
        >
          {t.options.actions.exportJson}
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

async function speakWord(word: string): Promise<void> {
  const response = await sendMessage<PronunciationResult>({
    type: "GET_PRONUNCIATION",
    word,
  });

  if (response.audioUrl) {
    await new Audio(response.audioUrl).play();
    return;
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(word));
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
