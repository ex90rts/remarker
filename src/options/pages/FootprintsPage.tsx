import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
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
import { ChevronRight, RefreshCcw, RotateCcw, Star } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { DailyActivity } from "../../shared/activity";
import {
  ACTIVITY_LEVEL_COLORS,
  buildDailyActivity,
  getActivityColor,
  getLocalDateKey,
} from "../../shared/activity";
import type { Messages } from "../../shared/i18n";
import { interpolate } from "../../shared/i18n";
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
  SourceLink,
  TableActionBar,
} from "../components";
import { useRuntimeQuery, useValidServerPage } from "../hooks";
import type { RunAction } from "../types";
import { formatCreatedAt, sendMessage } from "../utils";

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

export function FootprintsTab({
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
