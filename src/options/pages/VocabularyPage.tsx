import {
  Box,
  Button,
  Collapse,
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
  Typography,
} from "@mui/material";
import {
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCcw,
  RotateCcw,
  SquarePen,
  Volume2,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  createNotionTranslationExport,
  createNotionVocabularyExport,
  createObsidianTranslationExport,
  createObsidianVocabularyExport,
} from "../../shared/export";
import type { Messages } from "../../shared/i18n";
import { interpolate } from "../../shared/i18n";
import { markdownToSafeHtml } from "../../shared/markdown";
import type { DataQuery, ListAllDataResult } from "../../shared/messages";
import { playPronunciation } from "../../shared/pronunciation";
import type {
  AppSettings,
  RecordsPageSize,
  VocabularyRecord,
} from "../../shared/types";
import { isSingleEnglishWord } from "../../shared/word";

import {
  ConfirmDeleteIconButton,
  CopyIconButton,
  EmptyTableRow,
  ExportDropdownButton,
  RecordsTablePagination,
  SourceLink,
  TableActionBar,
  markdownBodySx,
  renderHighlightedContext,
  twoLineClampSx,
} from "../components";
import { useRuntimeQuery, useValidServerPage } from "../hooks";
import type { Notify, RunAction, SourceFilterNavigation } from "../types";
import {
  downloadFile,
  formatCreatedAt,
  includesFuzzy,
  sendMessage,
  sortByCreatedAtDesc,
} from "../utils";

export function VocabularyTab({
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
                          aria-label={interpolate(t.options.actions.speakWord, {
                            word: item.word,
                          })}
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

export function VocabularyReviewView({
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

export function getReviewCopy(language: AppSettings["ui"]["language"]) {
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
