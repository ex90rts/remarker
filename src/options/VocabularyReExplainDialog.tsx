import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Messages } from "../shared/i18n";
import { interpolate } from "../shared/i18n";
import {
  LLM_STREAM_PORT,
  type LlmStreamClientMessage,
  type LlmStreamEvent,
} from "../shared/llm-stream";
import type { VocabularyRecord } from "../shared/types";
import { MarkdownBody } from "./components";
import { sendMessage } from "./utils";

type ReExplainPhase =
  | "idle"
  | "generating"
  | "ready"
  | "generation-error"
  | "replacing";

interface ActiveExplanationStream {
  requestId: string;
  port: chrome.runtime.Port;
  accumulated: string;
  animationFrame?: number;
}

export function VocabularyReExplainDialog({
  open,
  record,
  onClose,
  onReplaced,
  t,
}: {
  open: boolean;
  record: VocabularyRecord;
  onClose: () => void;
  onReplaced: (translation: string) => void;
  t: Messages;
}) {
  const [phase, setPhase] = useState<ReExplainPhase>("idle");
  const [generatedExplanation, setGeneratedExplanation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const activeStreamRef = useRef<ActiveExplanationStream | undefined>(
    undefined,
  );

  useEffect(() => {
    cancelActiveStream();
    setPhase("idle");
    setGeneratedExplanation("");
    setErrorMessage("");
    return cancelActiveStream;
  }, [open, record.id]);

  function startGeneration(): void {
    cancelActiveStream();
    setPhase("generating");
    setGeneratedExplanation("");
    setErrorMessage("");

    const requestId = crypto.randomUUID();
    const port = chrome.runtime.connect({ name: LLM_STREAM_PORT });
    activeStreamRef.current = {
      requestId,
      port,
      accumulated: "",
    };
    const payload: Extract<
      LlmStreamClientMessage,
      { type: "start" }
    >["payload"] = {
      type: "EXPLAIN_SELECTION",
      selectionKind: "word",
      selectedText: record.word,
      context: record.contextSentence,
      sourceUrl: record.sourceUrl,
      sourceTitle: record.sourceTitle,
      anchor: record.anchor,
      forceRefresh: true,
      previewOnly: true,
    };

    port.onMessage.addListener((event: LlmStreamEvent) => {
      if (event.requestId !== requestId) return;
      if (event.type === "chunk") {
        const stream = activeStreamRef.current;
        if (!stream || stream.requestId !== requestId) return;
        stream.accumulated += event.content;
        if (stream.animationFrame !== undefined) return;
        stream.animationFrame = requestAnimationFrame(() => {
          const current = activeStreamRef.current;
          if (!current || current.requestId !== requestId) return;
          current.animationFrame = undefined;
          setGeneratedExplanation(current.accumulated);
        });
      } else if (event.type === "completed") {
        finishActiveStream(requestId);
        setGeneratedExplanation(event.result.result);
        setPhase("ready");
      } else if (event.type === "error") {
        finishActiveStream(requestId);
        setErrorMessage(event.error);
        setPhase("generation-error");
      }
    });
    port.onDisconnect.addListener(() => {
      const stream = activeStreamRef.current;
      if (!stream || stream.requestId !== requestId) return;
      if (stream.animationFrame !== undefined) {
        cancelAnimationFrame(stream.animationFrame);
      }
      activeStreamRef.current = undefined;
      setErrorMessage(t.options.reExplain.disconnected);
      setPhase("generation-error");
    });

    try {
      port.postMessage({
        type: "start",
        requestId,
        payload,
      } satisfies LlmStreamClientMessage);
    } catch (error) {
      finishActiveStream(requestId);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setPhase("generation-error");
    }
  }

  function finishActiveStream(requestId: string): void {
    const stream = activeStreamRef.current;
    if (!stream || stream.requestId !== requestId) return;
    if (stream.animationFrame !== undefined) {
      cancelAnimationFrame(stream.animationFrame);
    }
    activeStreamRef.current = undefined;
    stream.port.disconnect();
  }

  function cancelActiveStream(): void {
    const stream = activeStreamRef.current;
    if (!stream) return;
    activeStreamRef.current = undefined;
    if (stream.animationFrame !== undefined) {
      cancelAnimationFrame(stream.animationFrame);
    }
    try {
      stream.port.postMessage({
        type: "cancel",
        requestId: stream.requestId,
      } satisfies LlmStreamClientMessage);
    } catch {
      // The port may already be disconnected; cancellation is still complete.
    } finally {
      stream.port.disconnect();
    }
  }

  async function replaceExplanation(): Promise<void> {
    if (!generatedExplanation || phase !== "ready") return;
    setPhase("replacing");
    setErrorMessage("");
    try {
      await sendMessage<VocabularyRecord>({
        type: "UPDATE_VOCABULARY_TRANSLATION",
        id: record.id,
        translation: generatedExplanation,
      });
      onReplaced(generatedExplanation);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setPhase("ready");
    }
  }

  const isReplacing = phase === "replacing";
  const canReview = phase === "ready" || isReplacing;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isReplacing) onClose();
      }}
      fullWidth
      maxWidth="md"
      aria-labelledby="re-explain-dialog-title"
    >
      <DialogTitle id="re-explain-dialog-title">
        <Stack direction="row" spacing={1} alignItems="center">
          <Sparkles size={19} />
          <Typography component="span" variant="h6">
            {interpolate(t.options.reExplain.title, { word: record.word })}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {phase === "idle" ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 7 }}>
            <Button
              variant="contained"
              startIcon={<Sparkles size={16} />}
              onClick={startGeneration}
            >
              {t.options.reExplain.start}
            </Button>
          </Stack>
        ) : phase === "generating" ? (
          <Stack spacing={2}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="center"
              spacing={1.5}
              sx={{ py: generatedExplanation ? 0 : 7 }}
            >
              <CircularProgress size={24} />
              <Typography color="text.secondary" textAlign="center">
                {t.options.reExplain.generating}
              </Typography>
            </Stack>
            {generatedExplanation && (
              <ExplanationPreview
                label={t.options.reExplain.newExplanation}
                value={generatedExplanation}
              />
            )}
          </Stack>
        ) : phase === "generation-error" ? (
          <Typography color="error.main" sx={{ py: 3 }}>
            {interpolate(t.options.reExplain.failed, {
              reason: errorMessage,
            })}
          </Typography>
        ) : (
          <Stack spacing={2}>
            <ExplanationPreview
              label={t.options.reExplain.currentExplanation}
              value={record.translation || t.common.empty}
              muted
            />
            <ExplanationPreview
              label={t.options.reExplain.newExplanation}
              value={generatedExplanation}
            />
            <Typography fontWeight={600}>
              {t.options.reExplain.replacePrompt}
            </Typography>
            {errorMessage && (
              <Typography color="error.main">
                {interpolate(t.options.reExplain.replaceFailed, {
                  reason: errorMessage,
                })}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isReplacing}>
          {t.common.cancel}
        </Button>
        {phase === "generation-error" && (
          <Button
            variant="contained"
            onClick={startGeneration}
          >
            {t.options.reExplain.retry}
          </Button>
        )}
        {canReview && (
          <Button
            variant="contained"
            startIcon={
              isReplacing ? (
                <CircularProgress size={15} color="inherit" />
              ) : undefined
            }
            disabled={isReplacing}
            onClick={() => void replaceExplanation()}
          >
            {isReplacing
              ? t.options.reExplain.replacing
              : t.options.reExplain.replace}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function ExplanationPreview({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        component="div"
        sx={{ mb: 0.75 }}
      >
        {label}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          maxHeight: 260,
          overflowY: "auto",
        }}
      >
        <MarkdownBody
          markdown={value}
          sx={{
            color: muted ? "text.secondary" : "text.primary",
            "& > :first-of-type": { mt: 0 },
            "& > :last-child": { mb: 0 },
          }}
        />
      </Paper>
    </Box>
  );
}
