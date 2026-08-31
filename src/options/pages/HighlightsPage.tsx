import {
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createHighlightsMarkdownExport,
  createNotionHighlightsExport,
} from "../../shared/export";
import type { Messages } from "../../shared/i18n";
import { interpolate } from "../../shared/i18n";
import {
  LLM_STREAM_PORT,
  type LlmStreamClientMessage,
  type LlmStreamEvent,
} from "../../shared/llm-stream";
import {
  LANGUAGE_CHUNK_LIMIT,
  normalizeLanguageChunkResponse,
  parseLanguageChunkItems,
  segmentTextByLanguageChunk,
  type LanguageChunkItem,
} from "../../shared/language-chunks";
import type { DataQuery, ListAllDataResult } from "../../shared/messages";
import type {
  HighlightColor,
  HighlightRecord,
  ReadingAnalysisRecord,
  RecordsPageSize,
} from "../../shared/types";

import {
  ConfirmDeleteIconButton,
  ConfirmPopover,
  CopyIconButton,
  EmptyTableRow,
  ExportDropdownButton,
  HIGHLIGHT_COLORS,
  MarkdownBody,
  RecordsTablePagination,
  SourceLink,
  TableActionBar,
  twoLineClampSx,
} from "../components";
import { useRuntimeQuery, useValidServerPage } from "../hooks";
import type { Notify, RunAction, SourceFilterNavigation } from "../types";
import {
  downloadFile,
  formatCreatedAt,
  getHighlightStatusDescription,
  includesFuzzy,
  sendMessage,
  sortByCreatedAtDesc,
} from "../utils";

export function HighlightsTab({
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
  const [analysisHistoryCount, setAnalysisHistoryCount] = useState(0);
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
    void sendMessage<number>({ type: "GET_READING_ANALYSIS_COUNT" })
      .then(setAnalysisHistoryCount)
      .catch((error: unknown) => {
        notify(
          interpolate(t.options.readingAnalysis.failed, {
            reason: error instanceof Error ? error.message : String(error),
          }),
          "error",
        );
      });
  }, [refreshRevision]);

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
              variant="outlined"
              aria-label={`${t.options.readingAnalysis.action}: ${analysisHistoryCount}`}
              startIcon={<Sparkles size={16} />}
              onClick={() => setIsAnalysisOpen(true)}
            >
              {t.options.readingAnalysis.action}
              <Chip
                component="span"
                label={analysisHistoryCount}
                size="small"
                sx={{
                  height: 24,
                  minWidth: 28,
                  ml: 1,
                  borderRadius: "999px",
                  color: "text.primary",
                  fontWeight: 500,
                  fontSize: 12,
                  fontVariantNumeric: "tabular-nums",
                  "& .MuiChip-label": { px: 0.9 },
                }}
              />
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
                            <MarkdownBody
                              markdown={highlight.note}
                              sx={{
                                color: "inherit",
                                fontSize: "0.875rem",
                                maxWidth: 360,
                                overflowWrap: "anywhere",
                                "& > :first-of-type": { mt: 0 },
                                "& > :last-child": { mb: 0 },
                              }}
                            />
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
        onHistoryCountChange={setAnalysisHistoryCount}
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
  onHistoryCountChange,
  notify,
  runAction,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onHistoryCountChange: (count: number) => void;
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
  const activeStreamRef = useRef<
    | {
        requestId: string;
        port: chrome.runtime.Port;
      }
    | undefined
  >(undefined);
  const hasLoadedForOpenRef = useRef(false);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    // Move focus before MUI hides the background application with aria-hidden.
    dialogTitleRef.current?.focus({ preventScroll: true });
  }, [open]);

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
    onHistoryCountChange(records.length);
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
        setHistory((records) => {
          const nextRecords = [
            event.result,
            ...records.filter((record) => record.id !== event.result.id),
          ].sort((left, right) =>
            right.createdAt.localeCompare(left.createdAt),
          );
          onHistoryCountChange(nextRecords.length);
          return nextRecords;
        });
        setSelectedId(event.result.id);
        port.disconnect();
        return;
      }
      if (event.type === "error") {
        activeStreamRef.current = undefined;
        setIsAnalyzing(false);
        setErrorMessage(event.error);
        notify(
          interpolate(t.options.readingAnalysis.failed, {
            reason: event.error,
          }),
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
      setHistory((records) => {
        const nextRecords = records.filter((record) => record.id !== id);
        onHistoryCountChange(nextRecords.length);
        return nextRecords;
      });
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
      <DialogTitle
        ref={dialogTitleRef}
        tabIndex={-1}
        sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}
      >
        <Sparkles size={19} />
        {t.options.readingAnalysis.title}
        <IconButton
          aria-label={t.content.close}
          title={t.content.close}
          onClick={onClose}
          sx={{ ml: "auto" }}
        >
          <X size={20} />
        </IconButton>
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
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ px: 2.25, pt: 1.25, flexShrink: 0 }}
              >
                {t.options.readingAnalysis.history}
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.25 }}>
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
                  flexShrink: 0,
                  p: 1.25,
                }}
              >
                <Button
                  fullWidth
                  variant="outlined"
                  color="primary"
                  startIcon={<Sparkles size={16} />}
                  disabled={isAnalyzing}
                  onClick={startAnalysis}
                  sx={{
                    color: "primary.main",
                    borderColor: "primary.main",
                    "&:hover": {
                      borderColor: "primary.dark",
                    },
                    "&.Mui-disabled": {
                      color: "primary.main",
                      borderColor: "primary.main",
                      opacity: 0.5,
                    },
                  }}
                >
                  {t.options.readingAnalysis.newAnalysis}
                </Button>
              </Box>
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
                <MarkdownBody
                  markdown={displayedResult}
                  sx={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    overflowWrap: "anywhere",
                    "& > :first-of-type": { mt: 0 },
                    "& > :last-child": { mb: 0 },
                  }}
                />
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
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
        "&:hover .reading-analysis-delete-action, &:focus-within .reading-analysis-delete-action":
          {
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
  const [isEditingLanguageChunks, setIsEditingLanguageChunks] = useState(false);
  const [isRegeneratingChunks, setIsRegeneratingChunks] = useState(false);
  const [hoveredLanguageChunk, setHoveredLanguageChunk] = useState<string>();
  const [noteDraft, setNoteDraft] = useState(highlight.note ?? "");
  const [languageChunksDraft, setLanguageChunksDraft] = useState(
    highlight.languageChunks ?? "",
  );
  const [languageChunkItemsDraft, setLanguageChunkItemsDraft] = useState<
    LanguageChunkItem[] | undefined
  >(() => parseLanguageChunkItems(highlight.languageChunks ?? ""));

  useEffect(() => {
    if (!isEditingNote) setNoteDraft(highlight.note ?? "");
  }, [highlight.note, isEditingNote]);

  useEffect(() => {
    if (!isEditingLanguageChunks) {
      const value = highlight.languageChunks ?? "";
      setLanguageChunksDraft(value);
      setLanguageChunkItemsDraft(parseLanguageChunkItems(value));
    }
  }, [highlight.languageChunks, isEditingLanguageChunks]);

  useEffect(() => {
    setHoveredLanguageChunk(undefined);
  }, [highlight.languageChunks]);

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

  async function regenerateLanguageChunks() {
    setHoveredLanguageChunk(undefined);
    setIsRegeneratingChunks(true);
    try {
      await runAction(async () => {
        await sendMessage({
          type: "REGENERATE_HIGHLIGHT_LANGUAGE_CHUNKS",
          id: highlight.id,
        });
        await onChange();
      }, t.options.notices.languageChunksRegenerated);
    } finally {
      setIsRegeneratingChunks(false);
    }
  }

  async function saveLanguageChunks() {
    const value = languageChunkItemsDraft
      ? languageChunkItemsDraft.length > 0
        ? normalizeLanguageChunkResponse(
            JSON.stringify(languageChunkItemsDraft),
          )
        : ""
      : languageChunksDraft;
    await runAction(async () => {
      await sendMessage({
        type: "UPDATE_HIGHLIGHT_LANGUAGE_CHUNKS",
        id: highlight.id,
        languageChunks: value,
      });
      setIsEditingLanguageChunks(false);
      await onChange();
    }, t.options.notices.languageChunksSaved);
  }

  function beginEditingLanguageChunks() {
    const value = highlight.languageChunks ?? "";
    const items = parseLanguageChunkItems(value);
    setHoveredLanguageChunk(undefined);
    setLanguageChunksDraft(value);
    setLanguageChunkItemsDraft(items ?? (value ? undefined : []));
    setIsEditingLanguageChunks(true);
  }

  function cancelEditingLanguageChunks() {
    const value = highlight.languageChunks ?? "";
    setLanguageChunksDraft(value);
    setLanguageChunkItemsDraft(parseLanguageChunkItems(value));
    setIsEditingLanguageChunks(false);
  }

  const languageChunkItemsAreValid =
    languageChunkItemsDraft?.every(
      (item) =>
        Boolean(item.chunk.trim()) &&
        Boolean(item.meaning.trim()) &&
        Boolean(item.useCases.trim()),
    ) ?? Boolean(languageChunksDraft.trim());

  return (
    <Box
      sx={{
        mx: { xs: 0, sm: 2 },
        my: 1.25,
        px: { xs: 1.5, sm: 2 },
        pt: 1.75,
        pb: 1.5,
        bgcolor: "#f8faff",
        border: "1px solid",
        borderColor: "divider",
        borderLeft: "3px solid",
        borderLeftColor: HIGHLIGHT_COLORS[highlight.color],
        borderRadius: "4px 10px 10px 4px",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        color: "text.primary",
      }}
    >
      <Box component="section">
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: 0.5, fontWeight: 700 }}
        >
          {t.options.columns.highlightedText}
        </Typography>
        <Typography
          component="blockquote"
          sx={{
            m: 0,
            fontFamily: "Georgia, 'Noto Serif', serif",
            fontSize: { xs: "0.96rem", sm: "1.02rem" },
            fontWeight: 500,
            lineHeight: 1.7,
            letterSpacing: "0.005em",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          <HighlightedLanguageChunkText
            text={highlight.selectedText}
            activeChunk={hoveredLanguageChunk}
          />
        </Typography>
      </Box>

      <Stack spacing={1.25} sx={{ mt: 1.75 }}>
        <HighlightDetailSection
          label={t.options.columns.languageChunks}
          actions={
            !isEditingLanguageChunks ? (
              <>
                <Tooltip
                  arrow
                  title={t.options.actions.regenerateLanguageChunks}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t.options.actions.regenerateLanguageChunks}
                      disabled={isRegeneratingChunks}
                      onClick={() => void regenerateLanguageChunks()}
                      sx={{ color: "text.secondary" }}
                    >
                      {isRegeneratingChunks ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <RotateCcw size={16} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip arrow title={t.options.actions.editLanguageChunks}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t.options.actions.editLanguageChunks}
                      disabled={isRegeneratingChunks}
                      onClick={beginEditingLanguageChunks}
                      sx={{ color: "text.secondary" }}
                    >
                      <SquarePen size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            ) : undefined
          }
        >
          {isEditingLanguageChunks ? (
            <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
              {languageChunkItemsDraft ? (
                <LanguageChunkListEditor
                  items={languageChunkItemsDraft}
                  onChange={setLanguageChunkItemsDraft}
                  t={t}
                />
              ) : (
                <TextField
                  autoFocus
                  fullWidth
                  multiline
                  minRows={5}
                  value={languageChunksDraft}
                  onChange={(event) =>
                    setLanguageChunksDraft(event.target.value)
                  }
                />
              )}
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button
                  size="small"
                  onClick={cancelEditingLanguageChunks}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!languageChunkItemsAreValid}
                  onClick={() => void saveLanguageChunks()}
                >
                  {t.options.actions.saveLanguageChunks}
                </Button>
              </Stack>
            </Stack>
          ) : highlight.languageChunks ? (
            <LanguageChunksBody
              value={highlight.languageChunks}
              onActiveChunkChange={setHoveredLanguageChunk}
            />
          ) : (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ py: 0.5, fontStyle: "italic" }}
            >
              {t.options.empty.languageChunks}
            </Typography>
          )}
        </HighlightDetailSection>

        <HighlightDetailSection
          label={t.options.columns.note}
          actions={
            !isEditingNote ? (
              <Tooltip
                arrow
                title={
                  highlight.note
                    ? t.options.actions.editHighlightNote
                    : t.options.actions.addHighlightNote
                }
              >
                <IconButton
                  size="small"
                  aria-label={
                    highlight.note
                      ? t.options.actions.editHighlightNote
                      : t.options.actions.addHighlightNote
                  }
                  onClick={() => {
                    setNoteDraft(highlight.note ?? "");
                    setIsEditingNote(true);
                  }}
                  sx={{ color: "text.secondary" }}
                >
                  <SquarePen size={16} />
                </IconButton>
              </Tooltip>
            ) : undefined
          }
        >
          {isEditingNote ? (
            <Stack spacing={1}>
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
          ) : highlight.note ? (
            <MarkdownBody
              markdown={highlight.note}
              sx={{
                fontSize: "0.875rem",
                overflowWrap: "anywhere",
                "& > :first-of-type": { mt: 0.5 },
                "& > :last-child": { mb: 0 },
              }}
            />
          ) : (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ py: 0.5, fontStyle: "italic" }}
            >
              {t.options.empty.note}
            </Typography>
          )}
        </HighlightDetailSection>
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 0.5, sm: 2 }}
        justifyContent="space-between"
        sx={{
          mt: 1.5,
          pt: 1.25,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography component="div" variant="caption" color="text.secondary">
          <Box component="span" sx={{ fontWeight: 700, mr: 0.75 }}>
            {t.options.columns.source}
          </Box>
          <SourceLink
            href={highlight.sourceUrl}
            label={highlight.sourceTitle || highlight.sourceUrl}
            truncate={false}
          />
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flexShrink: 0 }}
        >
          {t.common.created} {formatCreatedAt(highlight.createdAt)}
        </Typography>
      </Stack>
    </Box>
  );
}

function HighlightedLanguageChunkText({
  text,
  activeChunk,
}: {
  text: string;
  activeChunk: string | undefined;
}) {
  const segments = segmentTextByLanguageChunk(text, activeChunk);
  return segments.map((segment, index) =>
    segment.isMatch ? (
      <Box
        component="mark"
        key={`${index}-${segment.text}`}
        sx={{
          bgcolor: "#fde68a",
          color: "inherit",
          borderRadius: 0.5,
          boxShadow: "0 0 0 2px rgba(245, 158, 11, 0.18)",
        }}
      >
        {segment.text}
      </Box>
    ) : (
      <Fragment key={`${index}-${segment.text}`}>{segment.text}</Fragment>
    ),
  );
}

function LanguageChunkListEditor({
  items,
  onChange,
  t,
}: {
  items: LanguageChunkItem[];
  onChange: (items: LanguageChunkItem[]) => void;
  t: Messages;
}) {
  function updateItem(
    index: number,
    field: keyof LanguageChunkItem,
    value: string,
  ) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  return (
    <Stack spacing={1.25}>
      {items.map((item, index) => (
        <Box
          key={index}
          sx={{
            pb: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 0.75 }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
            >
              #{index + 1}
            </Typography>
            <Tooltip
              arrow
              title={interpolate(t.options.actions.removeLanguageChunk, {
                number: String(index + 1),
              })}
            >
              <IconButton
                size="small"
                aria-label={interpolate(t.options.actions.removeLanguageChunk, {
                  number: String(index + 1),
                })}
                onClick={() =>
                  onChange(
                    items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                sx={{ color: "text.secondary" }}
              >
                <Trash2 size={15} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Stack spacing={1}>
            <TextField
              autoFocus={index === 0}
              required
              fullWidth
              size="small"
              label={t.options.columns.languageChunk}
              value={item.chunk}
              onChange={(event) =>
                updateItem(index, "chunk", event.target.value)
              }
            />
            <TextField
              required
              fullWidth
              size="small"
              label={t.options.columns.languageChunkMeaning}
              value={item.meaning}
              onChange={(event) =>
                updateItem(index, "meaning", event.target.value)
              }
            />
            <TextField
              required
              fullWidth
              multiline
              minRows={2}
              size="small"
              label={t.options.columns.languageChunkUseCases}
              value={item.useCases}
              onChange={(event) =>
                updateItem(index, "useCases", event.target.value)
              }
            />
          </Stack>
        </Box>
      ))}
      <Button
        size="small"
        startIcon={<Plus size={16} />}
        disabled={items.length >= LANGUAGE_CHUNK_LIMIT}
        onClick={() =>
          onChange([...items, { chunk: "", meaning: "", useCases: "" }])
        }
        sx={{ alignSelf: "flex-start" }}
      >
        {t.options.actions.addLanguageChunk}
      </Button>
    </Stack>
  );
}

function LanguageChunksBody({
  value,
  onActiveChunkChange,
}: {
  value: string;
  onActiveChunkChange: (chunk: string | undefined) => void;
}) {
  const items = parseLanguageChunkItems(value);
  if (!items) {
    // Preserve readability for legacy Markdown and manually edited records.
    return (
      <MarkdownBody
        markdown={value}
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: "0.875rem",
          overflowWrap: "anywhere",
          "& > :first-of-type": { mt: 0.875 },
          "& > :last-child": { mb: 0 },
        }}
      />
    );
  }

  return (
    <Stack
      component="ol"
      divider={<Divider flexItem />}
      sx={{ m: 0, p: 0, listStyle: "none" }}
    >
      {items.map((item, index) => (
        <LanguageChunkRow
          key={`${item.chunk}-${index}`}
          item={item}
          onActiveChange={onActiveChunkChange}
        />
      ))}
    </Stack>
  );
}

function LanguageChunkRow({
  item,
  onActiveChange,
}: {
  item: LanguageChunkItem;
  onActiveChange: (chunk: string | undefined) => void;
}) {
  return (
    <Box
      component="li"
      tabIndex={0}
      aria-label={`${item.chunk}: ${item.meaning}`}
      onMouseEnter={() => onActiveChange(item.chunk)}
      onMouseLeave={(event) => {
        if (document.activeElement !== event.currentTarget) {
          onActiveChange(undefined);
        }
      }}
      onFocus={() => onActiveChange(item.chunk)}
      onBlur={(event) => {
        if (!event.currentTarget.matches(":hover")) {
          onActiveChange(undefined);
        }
      }}
      sx={{
        mx: -0.75,
        px: 0.75,
        py: 1,
        borderRadius: 1,
        transition: "background-color 120ms ease",
        "&:hover, &:focus-visible": { bgcolor: "rgba(59, 130, 246, 0.07)" },
        "&:focus-visible": { outline: "2px solid rgba(59, 130, 246, 0.35)" },
      }}
    >
      <Typography
        component="div"
        variant="body2"
        sx={{ fontWeight: 700, overflowWrap: "anywhere" }}
      >
        {item.chunk}
      </Typography>
      <Typography
        component="div"
        variant="body2"
        sx={{ mt: 0.25, overflowWrap: "anywhere" }}
      >
        {item.meaning}
      </Typography>
      <Typography
        component="div"
        variant="caption"
        color="text.secondary"
        sx={{
          display: "block",
          mt: 0.375,
          lineHeight: 1.55,
          overflowWrap: "anywhere",
        }}
      >
        {item.useCases}
      </Typography>
    </Box>
  );
}

function HighlightDetailSection({
  label,
  actions,
  children,
}: {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="section"
      sx={{
        pt: 1.25,
        pb: 0.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minHeight: 28 }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        {actions && (
          <Stack direction="row" spacing={0.25} sx={{ ml: "auto !important" }}>
            {actions}
          </Stack>
        )}
      </Stack>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
