import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Paper,
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
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Plus,
  RefreshCcw,
  RotateCcw,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import type { DailyActivity } from "../../shared/activity";
import {
  ACTIVITY_LEVEL_COLORS,
  buildDailyActivity,
  getActivityColor,
  getLocalDateKey,
} from "../../shared/activity";
import type { Messages } from "../../shared/i18n";
import { interpolate } from "../../shared/i18n";
import {
  MAX_COMMON_LINKS,
  isValidCommonLinkUrl,
  moveCommonLink,
  type CommonLink,
} from "../../shared/common-links";
import type { DataQuery, ListAllDataResult } from "../../shared/messages";
import type { TodayReviewProgress } from "../../shared/review";
import { getTodayReviewProgress } from "../../shared/review";
import type {
  AppSettings,
  FootprintListItem,
  RecordsPageSize,
} from "../../shared/types";

import {
  ConfirmArchiveIconButton,
  EmptyTableRow,
  RecordsTablePagination,
  SOURCE_LINK_COLOR,
  SourceLink,
  TableActionBar,
} from "../components";
import { useRuntimeQuery, useValidServerPage } from "../hooks";
import type { RunAction } from "../types";
import { formatCreatedAt, sendMessage } from "../utils";

interface ActivityCalendarDay {
  date: Date;
  dateKey: string;
}

function LearningActivityHeatmap({
  getFullSnapshot,
  refreshRevision,
  language,
  commonLinks,
  onSaveCommonLinks,
  onOpenVocabularyReview,
  runAction,
  t,
}: {
  getFullSnapshot: () => Promise<ListAllDataResult>;
  refreshRevision: number;
  language: AppSettings["ui"]["language"];
  commonLinks: CommonLink[];
  onSaveCommonLinks: (links: CommonLink[]) => Promise<void>;
  onOpenVocabularyReview: () => void;
  runAction: RunAction;
  t: Messages;
}) {
  const [activity, setActivity] = useState<Record<string, DailyActivity>>({});
  const [reviewProgress, setReviewProgress] = useState<TodayReviewProgress>(
    EMPTY_REVIEW_PROGRESS,
  );
  const [isLoading, setIsLoading] = useState(true);
  const days = useMemo(
    () => createSixMonthActivityCalendar(new Date()),
    [refreshRevision],
  );
  const monthStarts = useMemo(
    () =>
      days.flatMap((day, dayIndex) =>
        day.date.getDate() === 1 ? [{ day, dayIndex }] : [],
      ),
    [days],
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
      sx={{
        px: 0.5,
        pt: 0.25,
        height: { xs: "auto", md: ACTIVITY_SECTION_HEIGHT },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minWidth: 0,
          height: { xs: ACTIVITY_SECTION_HEIGHT, md: "100%" },
          p: 2,
          boxShadow: "none",
          bgcolor: "#fbfcfe",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 1.25, flexWrap: "wrap", rowGap: 1 }}
        >
          <Typography variant="h6">{t.options.activity.title}</Typography>
          <ActivityLegend t={t} />
        </Stack>
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            pb: 0.25,
            containerType: "inline-size",
            containerName: "activity-heatmap",
          }}
        >
          <Box
            role="img"
            aria-label={t.options.activity.title}
            sx={{
              "--activity-row-count": ACTIVITY_ROWS_WIDE,
              "--activity-column-count": Math.ceil(
                days.length / ACTIVITY_ROWS_WIDE,
              ),
              "--activity-grid-max-width": `${getActivityGridMaxWidth(
                days.length,
                ACTIVITY_ROWS_WIDE,
                ACTIVITY_CELL_SIZE_WIDE,
                ACTIVITY_GAP_WIDE,
              )}px`,
              "--activity-gap": `${ACTIVITY_GAP_WIDE}px`,
              position: "relative",
              width: "100%",
              maxWidth: "var(--activity-grid-max-width)",
              mx: "auto",
              pt: `${ACTIVITY_MONTH_LABEL_HEIGHT}px`,
              opacity: isLoading ? 0.55 : 1,
              transition: "opacity 120ms ease",
              "@container activity-heatmap (max-width: 760px)": {
                "--activity-row-count": ACTIVITY_ROWS_MEDIUM,
                "--activity-column-count": Math.ceil(
                  days.length / ACTIVITY_ROWS_MEDIUM,
                ),
                "--activity-grid-max-width": `${getActivityGridMaxWidth(
                  days.length,
                  ACTIVITY_ROWS_MEDIUM,
                  ACTIVITY_CELL_SIZE_MEDIUM,
                  ACTIVITY_GAP_MEDIUM,
                )}px`,
                "--activity-gap": `${ACTIVITY_GAP_MEDIUM}px`,
                "& .activity-month-label": {
                  gridColumn: "var(--month-column-medium)",
                },
              },
              "@container activity-heatmap (max-width: 500px)": {
                "--activity-row-count": ACTIVITY_ROWS_NARROW,
                "--activity-column-count": Math.ceil(
                  days.length / ACTIVITY_ROWS_NARROW,
                ),
                "--activity-grid-max-width": `${getActivityGridMaxWidth(
                  days.length,
                  ACTIVITY_ROWS_NARROW,
                  ACTIVITY_CELL_SIZE_NARROW,
                  ACTIVITY_GAP_NARROW,
                )}px`,
                "--activity-gap": `${ACTIVITY_GAP_NARROW}px`,
                "& .activity-month-label": {
                  gridColumn: "var(--month-column-narrow)",
                },
              },
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                position: "absolute",
                inset: "0 0 auto",
                display: "grid",
                gridTemplateColumns:
                  "repeat(var(--activity-column-count), minmax(0, 1fr))",
                columnGap: "var(--activity-gap)",
                pointerEvents: "none",
              }}
            >
              {monthStarts.map(({ day, dayIndex }) => (
                <Typography
                  key={day.dateKey}
                  component="span"
                  variant="caption"
                  className="activity-month-label"
                  sx={{
                    "--month-column-medium":
                      Math.floor(dayIndex / ACTIVITY_ROWS_MEDIUM) + 1,
                    "--month-column-narrow":
                      Math.floor(dayIndex / ACTIVITY_ROWS_NARROW) + 1,
                    gridColumn:
                      Math.floor(dayIndex / ACTIVITY_ROWS_WIDE) + 1,
                    gridRow: 1,
                    color: "text.secondary",
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {monthFormatter.format(day.date)}
                </Typography>
              ))}
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(var(--activity-column-count), minmax(0, 1fr))",
                gridTemplateRows:
                  "repeat(var(--activity-row-count), auto)",
                gridAutoFlow: "column",
                columnGap: "var(--activity-gap)",
                rowGap: "var(--activity-gap)",
              }}
            >
              {days.map((day) => {
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
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: "3px",
                      bgcolor: getActivityColor(dayActivity.total),
                      border: "1px solid",
                      borderColor: isMonthStart
                        ? ACTIVITY_MONTH_START_BORDER_COLOR
                        : "rgba(27, 31, 36, 0.06)",
                      boxSizing: "border-box",
                    }}
                  />
                );
                return (
                  <Tooltip
                    key={day.dateKey}
                    arrow
                    placement="top"
                    enterDelay={150}
                    title={tooltipContent}
                  >
                    {cell}
                  </Tooltip>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Paper>
      <TodayReviewCard
        progress={reviewProgress}
        isLoading={isLoading}
        onOpenReview={onOpenVocabularyReview}
        t={t}
      />
      <CommonLinksCard
        links={commonLinks}
        onSave={onSaveCommonLinks}
        runAction={runAction}
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
        width: { xs: "100%", md: 198 },
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

interface EditableCommonLink extends CommonLink {
  rowId: string;
}

let commonLinkRowSequence = 0;

function createEditableCommonLink(link?: CommonLink): EditableCommonLink {
  commonLinkRowSequence += 1;
  return {
    rowId: `common-link-${commonLinkRowSequence}`,
    url: link?.url ?? "",
    text: link?.text ?? "",
  };
}

function CommonLinksCard({
  links,
  onSave,
  runAction,
  t,
}: {
  links: CommonLink[];
  onSave: (links: CommonLink[]) => Promise<void>;
  runAction: RunAction;
  t: Messages;
}) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [draft, setDraft] = useState<EditableCommonLink[]>([]);
  const [loadingTitleRowId, setLoadingTitleRowId] = useState<string>();
  const [draggedRowId, setDraggedRowId] = useState<string>();
  const [dragOverRowId, setDragOverRowId] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const dialogTitleRef = useRef<HTMLHeadingElement>(null);
  const hasInvalidLink = draft.some(({ url, text }) => {
    const trimmedUrl = url.trim();
    return (
      (Boolean(trimmedUrl) && !isValidCommonLinkUrl(trimmedUrl)) ||
      (!trimmedUrl && Boolean(text.trim()))
    );
  });

  useLayoutEffect(() => {
    if (!isConfigOpen) return;

    // Move focus before MUI hides the background application with aria-hidden.
    dialogTitleRef.current?.focus({ preventScroll: true });
  }, [isConfigOpen]);

  function openConfiguration() {
    setDraft(links.map((link) => createEditableCommonLink(link)));
    setIsConfigOpen(true);
  }

  function closeConfiguration() {
    if (isSaving) return;
    setIsConfigOpen(false);
    setLoadingTitleRowId(undefined);
    clearDragState();
  }

  function updateDraftLink(
    rowId: string,
    field: keyof CommonLink,
    value: string,
  ) {
    setDraft((current) =>
      current.map((link) =>
        link.rowId === rowId ? { ...link, [field]: value } : link,
      ),
    );
  }

  function moveDraftLink(rowId: string, targetIndex: number) {
    setDraft((current) => {
      const sourceIndex = current.findIndex((link) => link.rowId === rowId);
      if (
        sourceIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.length ||
        sourceIndex === targetIndex
      ) {
        return current;
      }

      return moveCommonLink(current, sourceIndex, targetIndex);
    });
  }

  function startDragging(event: DragEvent<HTMLElement>, rowId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", rowId);
    setDraggedRowId(rowId);
  }

  function allowDrop(event: DragEvent<HTMLElement>, rowId: string) {
    if (!draggedRowId) return;
    if (draggedRowId === rowId) {
      setDragOverRowId(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverRowId(rowId);
  }

  function dropDraftLink(event: DragEvent<HTMLElement>, targetRowId: string) {
    event.preventDefault();
    if (!draggedRowId || draggedRowId === targetRowId) {
      clearDragState();
      return;
    }

    const targetIndex = draft.findIndex((link) => link.rowId === targetRowId);
    moveDraftLink(draggedRowId, targetIndex);
    clearDragState();
  }

  function clearDragState() {
    setDraggedRowId(undefined);
    setDragOverRowId(undefined);
  }

  async function lookupLinkTitle(link: EditableCommonLink) {
    const url = link.url.trim();
    if (!isValidCommonLinkUrl(url)) return;

    setLoadingTitleRowId(link.rowId);
    try {
      const result = await sendMessage<{ title?: string }>({
        type: "FETCH_LINK_TITLE",
        url,
      });
      if (!result.title) return;
      setDraft((current) =>
        current.map((candidate) =>
          candidate.rowId === link.rowId &&
          candidate.url.trim() === url &&
          !candidate.text.trim()
            ? { ...candidate, text: result.title ?? candidate.text }
            : candidate,
        ),
      );
    } catch {
      // Page-title lookup is best-effort; the URL remains usable without it.
    } finally {
      setLoadingTitleRowId((current) =>
        current === link.rowId ? undefined : current,
      );
    }
  }

  function saveConfiguration() {
    const nextLinks = draft
      .filter((link) => link.url.trim())
      .map(({ url, text }) => ({ url: url.trim(), text: text.trim() }));
    setIsSaving(true);
    void runAction(async () => {
      await onSave(nextLinks);
      setIsConfigOpen(false);
      clearDragState();
    }, t.options.activity.commonLinks.saved).finally(() => setIsSaving(false));
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        width: { xs: "100%", md: 228 },
        flexShrink: 0,
        p: 2,
        boxShadow: "none",
        bgcolor: "#fbfcfe",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">
          {t.options.activity.commonLinks.title}
        </Typography>
        <IconButton
          size="small"
          aria-label={t.options.activity.commonLinks.configure}
          title={t.options.activity.commonLinks.configure}
          onClick={openConfiguration}
          sx={{ color: "text.secondary" }}
        >
          <Settings size={14} />
        </IconButton>
      </Stack>

      {links.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1.5, lineHeight: 1.65 }}
        >
          {t.options.activity.commonLinks.empty}
        </Typography>
      ) : (
        <Box
          component="nav"
          aria-label={t.options.activity.commonLinks.title}
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 0.25,
            mt: 0.75,
            maxHeight: 144,
            overflowY: "auto",
            pr: 0.25,
          }}
        >
          {links.map((link) => (
            <Link
              key={`${link.url}-${link.text}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              underline="none"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                minHeight: 26,
                px: 0.75,
                borderRadius: 1,
                color: SOURCE_LINK_COLOR,
                fontSize: "0.79rem",
                fontWeight: 650,
                transition: "background-color 120ms ease",
                "&:hover": {
                  bgcolor: "#edf3fc",
                  color: SOURCE_LINK_COLOR,
                  textDecoration: "underline",
                },
              }}
            >
              <Box
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {link.text || link.url}
              </Box>
              <ExternalLink
                size={12}
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              />
            </Link>
          ))}
        </Box>
      )}

      <Dialog
        open={isConfigOpen}
        onClose={closeConfiguration}
        fullWidth
        maxWidth="md"
        scroll="paper"
        aria-labelledby="common-links-dialog-title"
        slotProps={{
          paper: {
            sx: {
              border: "1px solid #dfe5ef",
              boxShadow: "0 14px 38px rgba(31, 45, 70, 0.16)",
            },
          },
        }}
      >
        <DialogTitle
          id="common-links-dialog-title"
          ref={dialogTitleRef}
          tabIndex={-1}
          sx={{ pb: 1.25 }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="h6">
                {t.options.activity.commonLinks.configure}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {interpolate(t.options.activity.commonLinks.maximum, {
                  count: MAX_COMMON_LINKS,
                })}
              </Typography>
            </Box>
            <Button
              size="small"
              startIcon={<Plus size={15} />}
              disabled={draft.length >= MAX_COMMON_LINKS}
              onClick={() =>
                setDraft((current) => [...current, createEditableCommonLink()])
              }
            >
              {t.options.activity.commonLinks.add}
            </Button>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ py: 2 }}>
          <Stack spacing={1}>
            {draft.map((link, index) => {
              const trimmedUrl = link.url.trim();
              const isUrlInvalid =
                Boolean(trimmedUrl) && !isValidCommonLinkUrl(trimmedUrl);
              const hasTextWithoutUrl =
                !trimmedUrl && Boolean(link.text.trim());
              return (
                <Stack
                  key={link.rowId}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "stretch", sm: "flex-start" }}
                  onDragOver={(event) => allowDrop(event, link.rowId)}
                  onDrop={(event) => dropDraftLink(event, link.rowId)}
                  sx={{
                    p: 0.75,
                    mx: -0.75,
                    border: "1px solid",
                    borderColor:
                      dragOverRowId === link.rowId ? "#8baee8" : "transparent",
                    borderRadius: 1.5,
                    bgcolor:
                      dragOverRowId === link.rowId ? "#edf4ff" : "transparent",
                    opacity: draggedRowId === link.rowId ? 0.48 : 1,
                    transition:
                      "background-color 120ms ease, border-color 120ms ease, opacity 120ms ease",
                  }}
                >
                  <Stack
                    direction="row"
                    alignItems="center"
                    sx={{ flexShrink: 0, pt: { sm: 0.25 } }}
                  >
                    <IconButton
                      draggable
                      size="small"
                      aria-label={interpolate(
                        t.options.activity.commonLinks.reorder,
                        { label: link.text || link.url || String(index + 1) },
                      )}
                      onDragStart={(event) => startDragging(event, link.rowId)}
                      onDragEnd={clearDragState}
                      sx={{
                        cursor:
                          draggedRowId === link.rowId ? "grabbing" : "grab",
                        color: "#7a879b",
                        "&:hover": { bgcolor: "#edf2f8", color: "#40536f" },
                      }}
                    >
                      <GripVertical size={17} />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      aria-label={interpolate(
                        t.options.activity.commonLinks.moveUp,
                        { label: link.text || link.url || String(index + 1) },
                      )}
                      onClick={() => moveDraftLink(link.rowId, index - 1)}
                    >
                      <ArrowUp size={15} />
                    </IconButton>
                    <IconButton
                      size="small"
                      disabled={index === draft.length - 1}
                      aria-label={interpolate(
                        t.options.activity.commonLinks.moveDown,
                        { label: link.text || link.url || String(index + 1) },
                      )}
                      onClick={() => moveDraftLink(link.rowId, index + 1)}
                    >
                      <ArrowDown size={15} />
                    </IconButton>
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    label={t.options.activity.commonLinks.urlLabel}
                    value={link.url}
                    error={isUrlInvalid || hasTextWithoutUrl}
                    helperText={
                      isUrlInvalid || hasTextWithoutUrl
                        ? t.options.activity.commonLinks.invalidUrl
                        : " "
                    }
                    onChange={(event) =>
                      updateDraftLink(link.rowId, "url", event.target.value)
                    }
                    onBlur={() => void lookupLinkTitle(link)}
                    slotProps={{ htmlInput: { inputMode: "url" } }}
                    sx={{ flex: 1.5 }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t.options.activity.commonLinks.textLabel}
                    value={link.text}
                    onChange={(event) =>
                      updateDraftLink(link.rowId, "text", event.target.value)
                    }
                    slotProps={{
                      input: {
                        endAdornment:
                          loadingTitleRowId === link.rowId ? (
                            <CircularProgress
                              size={15}
                              aria-label={
                                t.options.activity.commonLinks.fetchingTitle
                              }
                            />
                          ) : undefined,
                      },
                    }}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    aria-label={t.options.activity.commonLinks.delete}
                    title={t.options.activity.commonLinks.delete}
                    onClick={() =>
                      setDraft((current) =>
                        current.filter(
                          (candidate) => candidate.rowId !== link.rowId,
                        ),
                      )
                    }
                    sx={{ mt: { sm: 0.25 }, color: "text.secondary" }}
                  >
                    <Trash2 size={17} />
                  </IconButton>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={closeConfiguration} disabled={isSaving}>
            {t.options.activity.commonLinks.cancel}
          </Button>
          <Button
            variant="contained"
            onClick={saveConfiguration}
            disabled={hasInvalidLink || isSaving}
          >
            {t.options.activity.commonLinks.save}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

const ACTIVITY_SECTION_HEIGHT = 208;
const ACTIVITY_ROWS_WIDE = 5;
const ACTIVITY_ROWS_MEDIUM = 6;
const ACTIVITY_ROWS_NARROW = 7;
const ACTIVITY_CELL_SIZE_WIDE = 18;
const ACTIVITY_CELL_SIZE_MEDIUM = 18;
const ACTIVITY_CELL_SIZE_NARROW = 15;
const ACTIVITY_GAP_WIDE = 3;
const ACTIVITY_GAP_MEDIUM = 2;
const ACTIVITY_GAP_NARROW = 2;
const ACTIVITY_MONTH_LABEL_HEIGHT = 18;
const ACTIVITY_MONTH_START_BORDER_COLOR = "#0073ffff";

function getActivityGridMaxWidth(
  dayCount: number,
  rowCount: number,
  cellSize: number,
  gap: number,
): number {
  const columnCount = Math.ceil(dayCount / rowCount);
  return columnCount * cellSize + Math.max(0, columnCount - 1) * gap;
}

function createSixMonthActivityCalendar(now: Date): ActivityCalendarDay[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const rangeStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const days: ActivityCalendarDay[] = [];
  for (
    const cursor = new Date(rangeStart);
    cursor <= today;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const date = new Date(cursor);
    days.push({
      date,
      dateKey: getLocalDateKey(date)!,
    });
  }

  return days;
}

export function FootprintsTab({
  recordsPageSize,
  commonLinks,
  onSaveCommonLinks,
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
  commonLinks: CommonLink[];
  onSaveCommonLinks: (links: CommonLink[]) => Promise<void>;
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
        commonLinks={commonLinks}
        onSaveCommonLinks={onSaveCommonLinks}
        onOpenVocabularyReview={onOpenVocabularyReview}
        runAction={runAction}
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
