import {
  Box,
  Button,
  Divider,
  FormLabel,
  IconButton,
  Menu,
  MenuItem,
  Popover,
  Stack,
  TableCell,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { keyframes } from "@mui/material/styles";
import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { Messages } from "../shared/i18n";
import { detectBrowserLanguage } from "../shared/i18n";
import type {
  AppSettings,
  HighlightColor,
  PromptTemplateType,
  RecordsPageSize,
} from "../shared/types";
import type { Notify, ToastState } from "./types";
import { formatError } from "./utils";

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#ffe66d",
  green: "#b7f7c2",
  blue: "#b8ddff",
  pink: "#ffc2d4",
  purple: "#d8c7ff",
};
export const HIGHLIGHT_COLOR_OPTIONS = Object.keys(
  HIGHLIGHT_COLORS,
) as HighlightColor[];

export function HighlightColorPreview({ color }: { color: HighlightColor }) {
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

export const REMARKER_GITHUB_URL = "https://github.com/ex90rts/remarker";
export const REPORT_ISSUE_URL =
  "https://github.com/ex90rts/remarker/issues/new";
export const TOAST_DURATION_MS = 1500;
export const LLM_TEST_ERROR_TOAST_DURATION_MS = 3000;
const PROMPT_REQUIRED_VARIABLES = ["{{selection}}", "{{context}}"] as const;

export const PROMPT_TEMPLATE_KEYS = {
  lookup: "lookupPromptTemplate",
  translation: "translationPromptTemplate",
  analysis: "analysisPromptTemplate",
} as const satisfies Record<
  PromptTemplateType,
  | "lookupPromptTemplate"
  | "translationPromptTemplate"
  | "analysisPromptTemplate"
>;

export const llmOnboardingShimmer = keyframes`
  0% {
    transform: translateX(-200%) skewX(-24deg);
  }
  55%, 100% {
    transform: translateX(600%) skewX(-24deg);
  }
`;

export const twoLineClampSx = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

export const markdownBodySx = {
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

export function Toast({
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

export const SOURCE_LINK_COLOR = "#00319d";

export function SourceLink({
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
        color: SOURCE_LINK_COLOR,
        textDecoration: "none",
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {label}
    </Typography>
  );
}

export function TableActionBar({
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

export function ExportDropdownButton({
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

export function EmptyTableRow({
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
  window.open(
    `https://en.wikipedia.org/wiki/Special:Random`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function RecordsTablePagination({
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

export function CopyIconButton({
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

export function ConfirmDeleteIconButton({
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

export function ConfirmArchiveIconButton({
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

export function ConfirmPopover({
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

export function SettingsField({
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

export function renderHighlightedContext(
  context: string,
  word: string,
): ReactNode {
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
