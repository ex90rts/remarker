import {
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  Bug,
  Footprints,
  Github,
  Highlighter,
  Info,
  Languages,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";
import { detectBrowserLanguage, getMessages } from "../shared/i18n";
import { DEFAULT_COMMON_LINKS, type CommonLink } from "../shared/common-links";
import type {
  ListAllDataResult,
  OptionsOverviewResult,
} from "../shared/messages";
import { DEFAULT_RECORDS_PAGE_SIZE } from "../shared/types";

import { REMARKER_GITHUB_URL, REPORT_ISSUE_URL, Toast } from "./components";
import { AboutTab } from "./pages/AboutPage";
import { FootprintsTab } from "./pages/FootprintsPage";
import { HighlightsTab } from "./pages/HighlightsPage";
import { SettingsTab } from "./pages/SettingsPage";
import type {
  SourceFilterNavigation,
  TabKey,
  ToastSeverity,
  ToastState,
} from "./types";
import {
  formatError,
  getInitialTab,
  getSourceSearchKeyword,
  getTabLabel,
  sendMessage,
} from "./utils";
import {
  VocabularyReviewView,
  VocabularyTab,
  getReviewCopy,
} from "./pages/VocabularyPage";

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

  async function saveCommonLinks(links: CommonLink[]) {
    await sendMessage({ type: "UPDATE_COMMON_LINKS", links });
    await reload();
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
                    commonLinks={
                      overview?.settings.ui.commonLinks ?? DEFAULT_COMMON_LINKS
                    }
                    onSaveCommonLinks={saveCommonLinks}
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
