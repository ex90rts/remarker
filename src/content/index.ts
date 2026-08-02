import {
  createSemanticContext,
  DEFAULT_CONTEXT_CHAR_LIMIT,
} from "../shared/context";
import { getSelectionKind, detectSpeechLanguage } from "../shared/word";
import {
  LLM_STREAM_PORT,
  type LlmStreamClientMessage,
  type LlmStreamEvent,
} from "../shared/llm-stream";

export {};

type HighlightColor = "yellow" | "green" | "blue" | "pink" | "purple";
type HighlightStatus = "pending" | "active" | "not_found" | "ambiguous";
type SupportedLanguage = "zh-CN" | "zh-TW" | "en" | "es";

interface TextAnchor {
  selectedText: string;
  prefixText: string;
  suffixText: string;
  textStart: number;
  textEnd: number;
}

interface HighlightRecord {
  id: string;
  urlKey: string;
  sourceUrl: string;
  sourceTitle: string;
  selectedText: string;
  color: HighlightColor;
  anchor: TextAnchor;
  status: HighlightStatus;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface RuntimeResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface SelectionState {
  text: string;
  range: Range;
  rect: DOMRect;
  isWord: boolean;
  isCrossBlock: boolean;
}

interface TextSnapshot {
  nodes: Text[];
  text: string;
}

interface ContextTextSnapshot {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

interface RangeMatch {
  range: Range;
  start: number;
}

interface SelectionLookupResult {
  id: string;
  selectionKind: "word" | "text";
  selectedText: string;
  context: string;
  sourceUrl: string;
  sourceTitle: string;
  anchor?: TextAnchor;
  result: string;
  createdAt: string;
}

interface VocabularyRecord {
  id: string;
  word: string;
  sourceUrl: string;
  contextSentence: string;
  anchor?: TextAnchor;
  translation?: string;
  phonetic?: string;
  createdAt: string;
}

interface ContentMessages {
  copy: string;
  googleSearch: string;
  speak: string;
  explain: string;
  translate: string;
  splitHighlight: string;
  highlight: string;
  highlightColor: string;
  changeToColor: string;
  delete: string;
  explaining: string;
  explainingProgress: string;
  explanation: string;
  translating: string;
  translatingProgress: string;
  translation: string;
  regenerate: string;
  copyExplanation: string;
  close: string;
  copied: string;
  savedHighlights: string;
  configureLlm: string;
  note: string;
  save: string;
  cancel: string;
}

const CONTENT_MESSAGES: Record<SupportedLanguage, ContentMessages> = {
  "zh-CN": {
    copy: "复制",
    googleSearch: "Google 搜索",
    speak: "发音",
    explain: "解释",
    translate: "翻译",
    splitHighlight: "拆分划线",
    highlight: "划线",
    highlightColor: "划线：{{color}}",
    changeToColor: "改为 {{color}}",
    delete: "删除",
    explaining: "解释中",
    explainingProgress: "解释中...",
    explanation: "解释",
    translating: "翻译中",
    translatingProgress: "翻译中...",
    translation: "翻译",
    regenerate: "重新获取",
    copyExplanation: "复制解释",
    close: "关闭",
    copied: "已复制",
    savedHighlights: "已保存 {{count}} 条划线。",
    configureLlm: "配置大模型",
    note: "笔记",
    save: "保存",
    cancel: "取消",
  },
  "zh-TW": {
    copy: "複製",
    googleSearch: "Google 搜尋",
    speak: "發音",
    explain: "解釋",
    translate: "翻譯",
    splitHighlight: "拆分標記",
    highlight: "標記",
    highlightColor: "標記：{{color}}",
    changeToColor: "改為 {{color}}",
    delete: "刪除",
    explaining: "解釋中",
    explainingProgress: "解釋中...",
    explanation: "解釋",
    translating: "翻譯中",
    translatingProgress: "翻譯中...",
    translation: "翻譯",
    regenerate: "重新取得",
    copyExplanation: "複製解釋",
    close: "關閉",
    copied: "已複製",
    savedHighlights: "已儲存 {{count}} 條標記。",
    configureLlm: "設定大型語言模型",
    note: "筆記",
    save: "儲存",
    cancel: "取消",
  },
  en: {
    copy: "Copy",
    googleSearch: "Search Google",
    speak: "Speak",
    explain: "Explain",
    translate: "Translate",
    splitHighlight: "Split highlight",
    highlight: "Highlight",
    highlightColor: "Highlight {{color}}",
    changeToColor: "Change to {{color}}",
    delete: "Delete",
    explaining: "Explaining",
    explainingProgress: "Explaining...",
    explanation: "Explanation",
    translating: "Translating",
    translatingProgress: "Translating...",
    translation: "Translation",
    regenerate: "Regenerate",
    copyExplanation: "Copy explanation",
    close: "Close",
    copied: "Copied",
    savedHighlights: "Saved {{count}} highlight{{plural}}.",
    configureLlm: "Configure LLM",
    note: "Note",
    save: "Save",
    cancel: "Cancel",
  },
  es: {
    copy: "Copiar",
    googleSearch: "Buscar en Google",
    speak: "Pronunciar",
    explain: "Explicar",
    translate: "Traducir",
    splitHighlight: "Dividir resaltado",
    highlight: "Resaltar",
    highlightColor: "Resaltar {{color}}",
    changeToColor: "Cambiar a {{color}}",
    delete: "Eliminar",
    explaining: "Explicando",
    explainingProgress: "Explicando...",
    explanation: "Explicación",
    translating: "Traduciendo",
    translatingProgress: "Traduciendo...",
    translation: "Traducción",
    regenerate: "Volver a generar",
    copyExplanation: "Copiar explicación",
    close: "Cerrar",
    copied: "Copiado",
    savedHighlights: "{{count}} resaltado{{plural}} guardado{{plural}}.",
    configureLlm: "Configurar LLM",
    note: "Nota",
    save: "Guardar",
    cancel: "Cancelar",
  },
};

const MISSING_LLM_CONFIG_ERROR = "LLM configuration is incomplete.";

const HIGHLIGHT_CLASS = "remarker-highlight";
const LOOKUP_CLASS = "remarker-lookup";
const LOOKUP_UNDERLINE_COLOR = "#f97316";
const CONTEXT_CHAR_LIMIT = DEFAULT_CONTEXT_CHAR_LIMIT;
const EDITOR_ISOLATED_EVENT_TYPES = [
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "paste",
  "copy",
  "cut",
] as const;
const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: "#ffe66d",
  green: "#b7f7c2",
  blue: "#b8ddff",
  pink: "#ffc2d4",
  purple: "#d8c7ff",
};

let shadowRoot: ShadowRoot;
let toolbar: HTMLDivElement;
let panel: HTMLDivElement;
let noteTooltip: HTMLDivElement;
let overlayHost: HTMLDivElement | undefined;
let currentSelection: SelectionState | undefined;
let currentUrlKey = normalizeUrlKey(location.href);
let panelPinned = false;
let toolbarPinned = false;
let toolbarAnchor: (() => DOMRect | undefined) | undefined;
let toolbarPlacement: "above" | "below" = "above";
let toolbarPositionFrame: number | undefined;
let suppressSelectionChangeUntil = 0;
let transientTimer: number | undefined;
let lookupPanelTimer: number | undefined;
let t: ContentMessages = getContentMessages(detectBrowserLanguage());
let autoCloseLookupPanelOnCopy = false;
let extensionActive = false;
let activeStream:
  | {
      requestId: string;
      port: chrome.runtime.Port;
      animationFrame?: number;
      reject?: (reason: unknown) => void;
    }
  | undefined;
const selectionChangeListener = debounce(handleSelectionChange, 120);

init().catch((error) => {
  console.warn("[Remarker] init failed", error);
});

async function init(): Promise<void> {
  chrome.storage.onChanged.addListener(handleStorageChange);
  await syncEnabledState();
}

async function loadMessages(): Promise<void> {
  const settings = await sendMessage<{
    ui: { language: SupportedLanguage; autoCloseLookupPanelOnCopy?: boolean };
  }>({ type: "GET_SETTINGS" }).catch(() => undefined);
  t = getContentMessages(settings?.ui.language ?? detectBrowserLanguage());
  autoCloseLookupPanelOnCopy = Boolean(settings?.ui.autoCloseLookupPanelOnCopy);
}

function getContentMessages(language: SupportedLanguage): ContentMessages {
  return CONTENT_MESSAGES[language] ?? CONTENT_MESSAGES.en;
}

function detectBrowserLanguage(): SupportedLanguage {
  const language = navigator.language.toLowerCase();
  if (
    language === "zh-cn" ||
    language === "zh-hans" ||
    language.startsWith("zh-hans-")
  )
    return "zh-CN";
  if (
    language === "zh-tw" ||
    language === "zh-hk" ||
    language === "zh-mo" ||
    language === "zh-hant" ||
    language.startsWith("zh-hant-")
  ) {
    return "zh-TW";
  }
  if (language.startsWith("zh")) return "zh-CN";
  if (language.startsWith("es")) return "es";
  return "en";
}

function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

async function isEnabledForCurrentPage(): Promise<boolean> {
  const cache = await chrome.storage.local.get([
    "globalEnabled",
    "disabledSites",
  ]);
  const globalEnabled = cache.globalEnabled ?? true;
  const disabledSites = Array.isArray(cache.disabledSites)
    ? cache.disabledSites
    : [];
  return Boolean(
    globalEnabled && !disabledSites.includes(location.hostname.toLowerCase()),
  );
}

async function activateExtension(): Promise<void> {
  if (extensionActive) return;

  await loadMessages();
  createOverlay();
  document.addEventListener("selectionchange", selectionChangeListener);
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
  document.addEventListener("scroll", scheduleToolbarPositionUpdate, true);
  window.addEventListener("resize", scheduleToolbarPositionUpdate);
  extensionActive = true;
  scheduleIdleRestore();
}

function deactivateExtension(): void {
  if (!extensionActive) return;

  document.removeEventListener("selectionchange", selectionChangeListener);
  document.removeEventListener("mousedown", handleDocumentMouseDown, true);
  document.removeEventListener("scroll", scheduleToolbarPositionUpdate, true);
  window.removeEventListener("resize", scheduleToolbarPositionUpdate);
  hideToolbar();
  removeRemarkerDecorations();
  overlayHost?.remove();
  overlayHost = undefined;
  currentSelection = undefined;
  panelPinned = false;
  toolbarPinned = false;
  clearTransientTimer();
  clearLookupPanelHideTimer();
  cancelActiveStream();
  extensionActive = false;
}

async function syncEnabledState(): Promise<void> {
  if (await isEnabledForCurrentPage()) {
    await activateExtension();
  } else {
    deactivateExtension();
  }
}

function handleStorageChange(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== "local") return;
  if (!changes.globalEnabled && !changes.disabledSites) return;
  void syncEnabledState();
}

function createOverlay(): void {
  overlayHost?.remove();
  const host = document.createElement("div");
  host.id = "remarker-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "2147483647";
  document.documentElement.append(host);
  overlayHost = host;

  shadowRoot = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    .toolbar, .panel {
      position: fixed;
      pointer-events: auto;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #17202a;
      background: #ffffff;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
      border-radius: 8px;
      display: none;
      z-index: 2147483647;
    }
    .toolbar {
      gap: 4px;
      padding: 6px;
      align-items: center;
      box-shadow:
        0 12px 30px rgba(15, 23, 42, 0.2),
        0 2px 8px rgba(15, 23, 42, 0.08);
    }
    .toolbar.visible { display: flex; }
    .panel {
      border: 1px solid rgba(15, 23, 42, 0.16);
      width: min(420px, calc(100vw - 32px));
      max-height: 360px;
      overflow: auto;
      padding: 12px;
      font-size: 13px;
      line-height: 1.55;
      overscroll-behavior: contain;
    }
    .panel.visible { display: block; }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #64748b;
    }
    .panel-body {
      max-height: 292px;
      overflow: auto;
      padding-right: 4px;
      overscroll-behavior: contain;
    }
    .skeleton-stack {
      display: grid;
      gap: 9px;
      padding: 2px 0 4px;
    }
    .skeleton-line {
      height: 12px;
      border-radius: 999px;
      background: linear-gradient(90deg, #eef2f7 0%, #dbe4ef 50%, #eef2f7 100%);
      background-size: 220% 100%;
      animation: remarker-skeleton 1.2s ease-in-out infinite;
    }
    .skeleton-line.short { width: 54%; }
    .skeleton-line.medium { width: 76%; }
    .skeleton-line.long { width: 94%; }
    @keyframes remarker-skeleton {
      0% { background-position: 120% 0; }
      100% { background-position: -120% 0; }
    }
    .markdown-body p { margin: 0 0 8px; }
    .markdown-body h3, .markdown-body h4, .markdown-body h5 {
      margin: 10px 0 6px;
      font-size: 13px;
      line-height: 1.35;
    }
    .markdown-body ul {
      margin: 6px 0 10px;
      padding-left: 20px;
    }
    .markdown-body li { margin: 3px 0; }
    .markdown-body blockquote {
      margin: 8px 0;
      padding-left: 10px;
      border-left: 3px solid #cbd5e1;
      color: #475569;
    }
    .markdown-body pre {
      margin: 8px 0;
      padding: 8px;
      overflow: auto;
      background: #f1f5f9;
      border-radius: 6px;
    }
    .markdown-body code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #f1f5f9;
      border-radius: 4px;
      padding: 1px 4px;
    }
    .markdown-body a { color: #1f6f68; }
    .markdown-body table {
      width: 100%;
      display: block;
      overflow-x: auto;
      border-collapse: collapse;
      margin: 8px 0 10px;
    }
    .markdown-body th, .markdown-body td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
    }
    .markdown-body th {
      background: #f8fafc;
      font-weight: 700;
    }
    .panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-top: 10px;
    }
    button {
      appearance: none;
      border: 0;
      border-radius: 6px;
      background: #f1f5f9;
      color: #0f172a;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      height: 28px;
      min-width: 28px;
      padding: 0 8px;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
    }
    button:hover { background: #e2e8f0; }
    button svg, .success-icon svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      stroke-width: 2;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    button.color {
      width: 22px;
      height: 22px;
      min-width: 22px;
      padding: 0;
      border: 1px solid rgba(15, 23, 42, 0.16);
    }
    .error { color: #b42318; }
    .success {
      color: #067647;
      background: #ecfdf3;
    }
    .success-icon {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .muted { color: #64748b; }
    .${LOOKUP_CLASS} {
      background: transparent;
      border-bottom: 2px solid ${LOOKUP_UNDERLINE_COLOR};
      cursor: help;
    }
    .${LOOKUP_CLASS}:hover {
      background: rgba(249, 115, 22, 0.08);
    }
    .note-editor { display: grid; gap: 10px; }
    .note-tooltip {
      position: fixed;
      display: none;
      box-sizing: border-box;
      max-width: min(360px, calc(100vw - 24px));
      padding: 7px 9px;
      border: 1px solid rgba(15, 23, 42, 0.16);
      border-radius: 6px;
      color: #17202a;
      background: #fff;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
      font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      pointer-events: none;
      white-space: pre-wrap;
    }
    .note-tooltip.visible { display: block; }
    .note-editor textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 110px;
      resize: vertical;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      color: #17202a;
      background: #fff;
      font: inherit;
    }
    @media (prefers-color-scheme: dark) {
      .toolbar, .panel, .note-tooltip { color: #e5e7eb; background: #111827; box-shadow: 0 10px 28px rgba(0,0,0,.55); }
      .panel { border-color: #374151; }
      .panel-header, .muted { color: #9ca3af; }
      button, .markdown-body pre, .markdown-body code { color: #e5e7eb; background: #1f2937; }
      button:hover { background: #374151; }
      .markdown-body blockquote { border-color: #4b5563; color: #d1d5db; }
      .markdown-body th, .markdown-body td { border-color: #4b5563; }
      .markdown-body th { background: #1f2937; }
      .note-editor textarea { color: #e5e7eb; background: #111827; border-color: #4b5563; }
      .skeleton-line { background: linear-gradient(90deg,#1f2937 0%,#374151 50%,#1f2937 100%); background-size: 220% 100%; }
    }
  `;

  toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  panel = document.createElement("div");
  panel.className = "panel";
  noteTooltip = document.createElement("div");
  noteTooltip.className = "note-tooltip";
  toolbar.addEventListener("mousedown", preserveSelectionInteraction);
  panel.addEventListener("mousedown", preserveSelectionInteraction);
  panel.addEventListener("wheel", containPanelWheel, { passive: false });
  shadowRoot.append(style, toolbar, panel, noteTooltip);
}

function handleSelectionChange(): void {
  if (Date.now() < suppressSelectionChangeUntil) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    if (panelPinned || toolbarPinned) return;
    hideToolbar();
    return;
  }

  const text = selection.toString().trim();
  if (!text) {
    hideToolbar();
    return;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = getRangeRect(range);
  if (!rect) {
    hideToolbar();
    return;
  }

  currentSelection = {
    text,
    range,
    rect,
    isWord: getSelectionKind(text, navigator.language) === "word",
    isCrossBlock:
      getBlockElement(range.startContainer) !==
      getBlockElement(range.endContainer),
  };
  renderToolbar(currentSelection);
}

function renderToolbar(selection: SelectionState): void {
  panelPinned = false;
  toolbarPinned = false;
  clearTransientTimer();
  toolbar.className = "toolbar";
  toolbar.replaceChildren();

  toolbar.append(createIconButton("copy", t.copy, copySelectionText));
  toolbar.append(
    createIconButton("search", t.googleSearch, searchSelectionInGoogle),
  );

  if (selection.isWord) {
    toolbar.append(createIconButton("volume", t.speak, speakSelection));
    toolbar.append(
      createIconButton("sparkles", t.explain, () =>
        explainCurrentSelection(false),
      ),
    );
  } else {
    toolbar.append(
      createIconButton("sparkles", t.translate, () =>
        explainCurrentSelection(false),
      ),
    );
    toolbar.append(
      createIconButton(
        "highlighter",
        selection.isCrossBlock ? t.splitHighlight : t.highlight,
        () => saveHighlight(selection, "yellow"),
      ),
    );
    for (const color of Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]) {
      const button = createIconButton(
        "circle",
        interpolate(t.highlightColor, { color }),
        () => saveHighlight(selection, color),
      );
      button.className = "color";
      button.title = color;
      button.style.background = HIGHLIGHT_COLORS[color];
      toolbar.append(button);
    }
  }

  toolbar.classList.add("visible");
  trackToolbarAnchor(() => {
    const rect = getRangeRect(selection.range);
    if (rect) selection.rect = rect;
    return rect;
  });
  panel.classList.remove("visible");
}

function createIconButton(
  icon: IconName,
  label: string,
  onClick: () => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = ICONS[icon];
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    suppressSelectionChange();
    Promise.resolve(onClick()).catch((error) => showErrorPanel(error));
  });
  return button;
}

async function copySelectionText(): Promise<void> {
  if (!currentSelection) return;
  await navigator.clipboard.writeText(currentSelection.text);
  showTransientSuccess(currentSelection.rect);
}

function searchSelectionInGoogle(): void {
  if (!currentSelection) return;
  const query = currentSelection.text.trim();
  if (!query) return;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function speakSelection(): Promise<void> {
  if (!currentSelection) return;

  const language = detectSpeechLanguage(currentSelection.text, t === CONTENT_MESSAGES["zh-TW"] ? "zh-TW" : navigator.language);
  const response = await sendMessage<{
    provider: string;
    audioDataUrl?: string;
    audioUrl?: string;
    language: string;
  }>({
    type: "GET_PRONUNCIATION",
    word: currentSelection.text,
    language,
  });

  if (response.audioDataUrl || response.audioUrl) {
    await new Audio(response.audioDataUrl ?? response.audioUrl).play();
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(currentSelection.text);
  utterance.lang = response.language || language;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === utterance.lang.toLowerCase())
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(utterance.lang.split("-")[0].toLowerCase()))
    ?? null;
  speechSynthesis.speak(utterance);
}

async function explainCurrentSelection(forceRefresh: boolean): Promise<void> {
  if (!currentSelection) return;

  const anchor = createTextAnchor(currentSelection.range);
  suppressSelectionChange();
  showExplanationPanel(
    currentSelection.isWord ? t.explainingProgress : t.translatingProgress,
    { isLoading: true },
  );
  const request: Extract<LlmStreamClientMessage, { type: "start" }>["payload"] = {
    type: "EXPLAIN_SELECTION",
    selectionKind: currentSelection.isWord ? "word" : "text",
    selectedText: currentSelection.text,
    context: getContextForRange(currentSelection.range),
    sourceUrl: location.href,
    sourceTitle: document.title,
    anchor,
    forceRefresh,
  };
  let explanation: SelectionLookupResult;
  try {
    explanation = await streamExplanation(request);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  }
  showExplanationPanel(explanation.result, { isLoading: false });
  if (currentSelection.isWord) {
    void applyLookupMarkers([
      {
        id: explanation.id,
        word: explanation.selectedText,
        sourceUrl: explanation.sourceUrl,
        contextSentence: explanation.context,
        anchor: explanation.anchor ?? anchor,
        translation: explanation.result,
        createdAt: explanation.createdAt,
      },
    ]);
  }
}

function streamExplanation(
  payload: Extract<LlmStreamClientMessage, { type: "start" }>["payload"],
): Promise<SelectionLookupResult> {
  cancelActiveStream();
  const requestId = crypto.randomUUID();
  const port = chrome.runtime.connect({ name: LLM_STREAM_PORT });
  activeStream = { requestId, port };
  let accumulated = "";
  return new Promise((resolve, reject) => {
    if (activeStream?.requestId === requestId) activeStream.reject = reject;
    port.onMessage.addListener((event: LlmStreamEvent) => {
      if (event.requestId !== requestId) return;
      if (event.type === "chunk") {
        accumulated += event.content;
        const stream = activeStream;
        if (stream && stream.animationFrame === undefined) {
          stream.animationFrame = requestAnimationFrame(() => {
            if (activeStream?.requestId === requestId) {
              activeStream.animationFrame = undefined;
              showExplanationPanel(accumulated, { isLoading: false });
            }
          });
        }
      } else if (event.type === "completed") {
        finishActiveStream(requestId);
        resolve(event.result);
      } else if (event.type === "error") {
        finishActiveStream(requestId);
        reject(new Error(event.error));
      }
    });
    port.onDisconnect.addListener(() => {
      if (activeStream?.requestId === requestId) {
        activeStream = undefined;
        reject(new Error("LLM stream disconnected before completion."));
      }
    });
    port.postMessage({ type: "start", requestId, payload } satisfies LlmStreamClientMessage);
  });
}

function finishActiveStream(requestId: string): void {
  if (activeStream?.requestId !== requestId) return;
  if (activeStream.animationFrame !== undefined) cancelAnimationFrame(activeStream.animationFrame);
  const port = activeStream.port;
  activeStream = undefined;
  port.disconnect();
}

function cancelActiveStream(): void {
  if (!activeStream) return;
  const stream = activeStream;
  activeStream = undefined;
  stream.port.postMessage({ type: "cancel", requestId: stream.requestId } satisfies LlmStreamClientMessage);
  if (stream.animationFrame !== undefined) cancelAnimationFrame(stream.animationFrame);
  stream.port.disconnect();
  stream.reject?.(new DOMException("LLM request was cancelled.", "AbortError"));
}

async function saveHighlight(
  selection: SelectionState,
  color: HighlightColor,
): Promise<void> {
  const existingHighlight = findExistingHighlightElementForRange(
    selection.range,
  );
  const existingId = existingHighlight?.dataset.remarkerId;
  if (existingHighlight && existingId) {
    existingHighlight.style.background = HIGHLIGHT_COLORS[color];
    await sendMessage({
      type: "UPDATE_HIGHLIGHT_COLOR",
      id: existingId,
      color,
    });
    showTransientSuccess(existingHighlight.getBoundingClientRect());
    return;
  }

  if (selection.isCrossBlock) {
    await saveSplitHighlights(selection, color);
    return;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const anchor = createTextAnchor(selection.range);
  const record: HighlightRecord = {
    id,
    urlKey: currentUrlKey,
    sourceUrl: location.href,
    sourceTitle: document.title,
    selectedText: selection.text,
    color,
    anchor,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  wrapRange(selection.range, color, id);
  await sendMessage({ type: "SAVE_HIGHLIGHT", record });
  hideToolbar();
}

async function saveSplitHighlights(
  selection: SelectionState,
  color: HighlightColor,
): Promise<void> {
  const blocks = getIntersectingBlocks(selection.range);
  let saved = 0;

  for (const block of blocks) {
    const text = block.innerText.trim();
    if (!text) continue;
    const range = document.createRange();
    range.selectNodeContents(block);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const anchor = createTextAnchor(range);

    const record: HighlightRecord = {
      id,
      urlKey: currentUrlKey,
      sourceUrl: location.href,
      sourceTitle: document.title,
      selectedText: anchor.selectedText,
      color,
      anchor,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    wrapRange(range, color, id);
    await sendMessage({ type: "SAVE_HIGHLIGHT", record });
    saved += 1;
  }

  showStatusPanel(
    interpolate(t.savedHighlights, {
      count: saved,
      plural: saved === 1 ? "" : "s",
    }),
    false,
  );
}

async function restoreHighlights(retriesRemaining = 1): Promise<void> {
  currentUrlKey = normalizeUrlKey(location.href);
  const records = await sendMessage<HighlightRecord[]>({
    type: "GET_HIGHLIGHTS_FOR_URL",
    urlKey: currentUrlKey,
  });
  const snapshot = getAnchorTextSnapshot();
  const validationText = getPageTextForRestoreValidation();
  const restorePlan: Array<{ record: HighlightRecord; match: RangeMatch }> = [];
  const statusUpdates: Array<{ id: string; status: HighlightStatus }> = [];

  for (const record of records) {
    const matches = findRangeMatchesForAnchor(record.anchor, snapshot);
    if (matches.length === 1) {
      restorePlan.push({ record, match: matches[0] });
      if (record.status !== "active") {
        statusUpdates.push({ id: record.id, status: "active" });
      }
    } else {
      const status: HighlightStatus =
        matches.length === 0 ? "not_found" : "ambiguous";
      if (record.status !== status) {
        statusUpdates.push({ id: record.id, status });
      }
    }
  }

  if (getPageTextForRestoreValidation() !== validationText) {
    if (retriesRemaining > 0) await restoreHighlights(retriesRemaining - 1);
    return;
  }
  if (statusUpdates.length) {
    await sendMessage({ type: "UPDATE_HIGHLIGHT_STATUSES", updates: statusUpdates });
  }
  const inserted: HTMLElement[] = [];
  const completed = await applyInIdleBatches(
    restorePlan.sort((left, right) => right.match.start - left.match.start),
    ({ record, match }) => {
      inserted.push(wrapRange(match.range, record.color, record.id, record.note));
    },
    40,
    () => getPageTextForRestoreValidation() === validationText,
  );
  if (!completed) {
    inserted.reverse().forEach((element) => {
      if (element.isConnected) unwrapElement(element);
    });
    if (retriesRemaining > 0) await restoreHighlights(retriesRemaining - 1);
  }
}

async function restoreVocabularyMarkers(): Promise<void> {
  const records = await sendMessage<VocabularyRecord[]>({
    type: "GET_VOCABULARY_FOR_URL",
    urlKey: currentUrlKey,
  });
  await applyLookupMarkers(records, 1);
}

async function applyLookupMarkers(
  records: VocabularyRecord[],
  retriesRemaining = 0,
): Promise<void> {
  const snapshot = getAnchorTextSnapshot();
  const validationText = getPageTextForRestoreValidation();
  const normalizedSnapshot = createNormalizedTextMap(snapshot.text);
  const plan: Array<{
    record: VocabularyRecord;
    match: RangeMatch;
  }> = [];

  for (const record of records) {
    const match = findLookupRangeMatch(record, snapshot, normalizedSnapshot);
    if (!match) continue;
    if (rangeIntersectsSelector(match.range, `.${LOOKUP_CLASS}`)) continue;
    plan.push({ record, match });
  }

  const inserted: HTMLElement[] = [];
  const completed = await applyInIdleBatches(
    plan.sort((left, right) => right.match.start - left.match.start),
    ({ record, match }) => {
      const wrapper = wrapLookupRange(match.range, record);
      if (wrapper) inserted.push(wrapper);
    },
    40,
    () => getPageTextForRestoreValidation() === validationText,
  );
  if (!completed) {
    inserted.reverse().forEach((element) => {
      if (element.isConnected) unwrapElement(element);
    });
    if (retriesRemaining > 0) await applyLookupMarkers(records, retriesRemaining - 1);
  }
}

function findLookupRangeMatch(
  record: VocabularyRecord,
  snapshot: TextSnapshot,
  normalizedSnapshot: NormalizedTextMap,
): RangeMatch | undefined {
  const anchorMatches = record.anchor
    ? findRangeMatchesForAnchor(record.anchor, snapshot)
    : [];

  if (anchorMatches.length === 1) return anchorMatches[0];

  if (anchorMatches.length > 1) {
    const resolved = resolveLookupAnchorMatches(
      record,
      anchorMatches,
      snapshot,
    );
    if (resolved) return resolved;
  }

  return findLookupRangeMatchByContext(record, snapshot, normalizedSnapshot);
}

function resolveLookupAnchorMatches(
  record: VocabularyRecord,
  matches: RangeMatch[],
  snapshot: TextSnapshot,
): RangeMatch | undefined {
  const scored = matches.map((match) => ({
    match,
    score: scoreLookupMatch(record, match, snapshot),
  }));
  scored.sort((left, right) => right.score - left.score);

  if (
    scored[0] &&
    scored[0].score > (scored[1]?.score ?? Number.NEGATIVE_INFINITY)
  ) {
    return scored[0].match;
  }

  if (record.anchor) {
    return [...matches].sort(
      (left, right) =>
        Math.abs(left.start - record.anchor!.textStart) -
        Math.abs(right.start - record.anchor!.textStart),
    )[0];
  }

  return undefined;
}

function scoreLookupMatch(
  record: VocabularyRecord,
  match: RangeMatch,
  snapshot: TextSnapshot,
): number {
  let score = 0;
  if (record.anchor) {
    score -= Math.abs(match.start - record.anchor.textStart);
  }

  const context = normalizeSearchText(record.contextSentence);
  if (context) {
    const windowStart = Math.max(
      0,
      match.start - record.contextSentence.length,
    );
    const windowEnd = Math.min(
      snapshot.text.length,
      match.start + record.word.length + record.contextSentence.length,
    );
    const windowText = normalizeSearchText(
      snapshot.text.slice(windowStart, windowEnd),
    );
    if (windowText.includes(context)) score += 10000;
    else if (windowText.includes(normalizeSearchText(record.word)))
      score += 100;
  }

  return score;
}

function findLookupRangeMatchByContext(
  record: VocabularyRecord,
  snapshot: TextSnapshot,
  normalizedSnapshot: NormalizedTextMap,
): RangeMatch | undefined {
  const context = normalizeSearchText(record.contextSentence);
  const word = (record.anchor?.selectedText || record.word).trim();
  const normalizedWord = normalizeSearchText(word);
  if (!context || !normalizedWord) return undefined;

  const contextMatches = findAllTextMatches(
    normalizedSnapshot.text.toLowerCase(),
    context.toLowerCase(),
  );
  if (contextMatches.length === 0) return undefined;

  const candidates: RangeMatch[] = [];
  for (const normalizedStart of contextMatches) {
    const normalizedEnd = normalizedStart + context.length;
    const originalStart = normalizedSnapshot.indexMap[normalizedStart];
    const originalEnd =
      normalizedSnapshot.indexMap[normalizedEnd - 1] !== undefined
        ? normalizedSnapshot.indexMap[normalizedEnd - 1] + 1
        : snapshot.text.length;
    const slice = snapshot.text.slice(originalStart, originalEnd);
    const offsets = findWordOffsetsInText(slice, word);

    for (const offset of offsets) {
      const start = originalStart + offset.start;
      const end = originalStart + offset.end;
      const range = createRangeFromTextOffsets(start, end, snapshot);
      if (!range || range.collapsed) continue;
      if (normalizeSearchText(range.toString()) !== normalizedWord) continue;
      candidates.push({ range, start });
    }
  }

  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  if (record.anchor) {
    return candidates.sort(
      (left, right) =>
        Math.abs(left.start - record.anchor!.textStart) -
        Math.abs(right.start - record.anchor!.textStart),
    )[0];
  }

  return candidates[0];
}

interface NormalizedTextMap {
  text: string;
  indexMap: number[];
}

function createNormalizedTextMap(value: string): NormalizedTextMap {
  let text = "";
  const indexMap: number[] = [];
  let previousWasWhitespace = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (/\s/.test(char)) {
      if (previousWasWhitespace) continue;
      text += " ";
      indexMap.push(index);
      previousWasWhitespace = true;
      continue;
    }

    text += char;
    indexMap.push(index);
    previousWasWhitespace = false;
  }

  return { text, indexMap };
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function findWordOffsetsInText(
  source: string,
  target: string,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  const normalizedTarget = target.trim().toLowerCase();
  if (!normalizedTarget) return matches;

  const lowerSource = source.toLowerCase();
  let index = lowerSource.indexOf(normalizedTarget);
  while (index !== -1) {
    const end = index + normalizedTarget.length;
    if (isWordBoundary(source[index - 1]) && isWordBoundary(source[end])) {
      matches.push({ start: index, end });
    }
    index = lowerSource.indexOf(normalizedTarget, index + 1);
  }

  return matches;
}

function isWordBoundary(char: string | undefined): boolean {
  return !char || !/[A-Za-z0-9]/.test(char);
}

function wrapLookupRange(range: Range, record: VocabularyRecord): HTMLElement | undefined {
  if (rangeIntersectsSelector(range, `.${LOOKUP_CLASS}`)) return undefined;

  const wrapper = document.createElement("span");
  wrapper.className = LOOKUP_CLASS;
  wrapper.dataset.remarkerVocabularyId = record.id;
  wrapper.style.background = "transparent";
  wrapper.style.borderBottom = `2px solid ${LOOKUP_UNDERLINE_COLOR}`;
  wrapper.style.cursor = "help";
  wrapper.addEventListener("mouseenter", () =>
    showLookupExplanationPanel(wrapper, record),
  );
  wrapper.addEventListener("mouseleave", scheduleLookupPanelHide);
  wrapper.addEventListener("mousedown", (event) => {
    event.stopPropagation();
    suppressSelectionChange();
  });

  try {
    range.surroundContents(wrapper);
  } catch {
    const fragment = range.extractContents();
    wrapper.append(fragment);
    range.insertNode(wrapper);
  }
  return wrapper;
}

function createTextAnchor(range: Range): TextAnchor {
  const snapshot = getAnchorTextSnapshot();
  const offsets = getTextOffsetsForRange(range, snapshot);
  const selectedText = offsets
    ? snapshot.text.slice(offsets.start, offsets.end)
    : range.toString();
  const textStart = offsets?.start ?? 0;
  const textEnd = textStart + selectedText.length;
  const fullText = snapshot.text;

  return {
    selectedText,
    prefixText: fullText.slice(Math.max(0, textStart - 80), textStart),
    suffixText: fullText.slice(textEnd, textEnd + 80),
    textStart,
    textEnd,
  };
}

function findRangesForAnchor(anchor: TextAnchor): Range[] {
  return findRangeMatchesForAnchor(anchor).map((match) => match.range);
}

function findRangeMatchesForAnchor(
  anchor: TextAnchor,
  snapshot = getAnchorTextSnapshot(),
): RangeMatch[] {
  const fullText = snapshot.text;
  const candidates: number[] = [];
  let index = fullText.indexOf(anchor.selectedText);

  while (index !== -1) {
    const prefix = fullText.slice(
      Math.max(0, index - anchor.prefixText.length),
      index,
    );
    const suffix = fullText.slice(
      index + anchor.selectedText.length,
      index + anchor.selectedText.length + anchor.suffixText.length,
    );
    const hasPrefix = anchor.prefixText ? prefix === anchor.prefixText : true;
    const hasSuffix = anchor.suffixText ? suffix === anchor.suffixText : true;
    if (hasPrefix || hasSuffix) {
      candidates.push(index);
    }
    index = fullText.indexOf(
      anchor.selectedText,
      index + Math.max(1, anchor.selectedText.length),
    );
  }

  if (
    candidates.length === 0 &&
    fullText.slice(anchor.textStart, anchor.textEnd) === anchor.selectedText
  ) {
    candidates.push(anchor.textStart);
  }

  if (candidates.length === 0) {
    const allMatches = findAllTextMatches(fullText, anchor.selectedText);
    if (allMatches.length === 1) {
      candidates.push(allMatches[0]);
    }
  }

  return candidates
    .map((start) => {
      const range = createRangeFromTextOffsets(
        start,
        start + anchor.selectedText.length,
        snapshot,
      );
      if (!range || range.collapsed || range.toString() !== anchor.selectedText)
        return undefined;
      return { range, start };
    })
    .filter(isRangeMatch);
}

function findAllTextMatches(source: string, target: string): number[] {
  const matches: number[] = [];
  let index = source.indexOf(target);
  while (index !== -1) {
    matches.push(index);
    index = source.indexOf(target, index + Math.max(1, target.length));
  }
  return matches;
}

function createRangeFromTextOffsets(
  start: number,
  end: number,
  snapshot = getAnchorTextSnapshot(),
): Range | undefined {
  const textNodes = snapshot.nodes;
  let position = 0;
  let startNode: Text | undefined;
  let endNode: Text | undefined;
  let startOffset = 0;
  let endOffset = 0;

  for (const node of textNodes) {
    const nextPosition = position + node.data.length;

    if (!startNode && start >= position && start < nextPosition) {
      startNode = node;
      startOffset = start - position;
    }

    if (!endNode && end > position && end <= nextPosition) {
      endNode = node;
      endOffset = end - position;
      break;
    }

    position = nextPosition;
  }

  if (!startNode || !endNode) return undefined;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function wrapRange(
  range: Range,
  color: HighlightColor,
  id: string,
  note?: string,
): HTMLElement {
  const wrapper = document.createElement("mark");
  wrapper.className = HIGHLIGHT_CLASS;
  wrapper.dataset.remarkerId = id;
  setHighlightNote(wrapper, note);
  wrapper.style.background = HIGHLIGHT_COLORS[color];
  wrapper.style.borderRadius = "3px";
  wrapper.style.padding = "0 1px";
  wrapper.addEventListener("click", (event) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return;
    event.stopPropagation();
    suppressSelectionChange();
    renderExistingHighlightToolbar(wrapper, id);
  });
  wrapper.addEventListener("mousedown", (event) => {
    if (event.button !== 0) event.stopPropagation();
  });
  wrapper.addEventListener("mouseenter", () => showHighlightNoteTooltip(wrapper));
  wrapper.addEventListener("mouseleave", hideHighlightNoteTooltip);
  wrapper.addEventListener("focus", () => showHighlightNoteTooltip(wrapper));
  wrapper.addEventListener("blur", hideHighlightNoteTooltip);

  try {
    range.surroundContents(wrapper);
  } catch {
    const fragment = range.extractContents();
    wrapper.append(fragment);
    range.insertNode(wrapper);
  }
  return wrapper;
}

function renderExistingHighlightToolbar(
  element: HTMLElement,
  id: string,
): void {
  hideHighlightNoteTooltip();
  panelPinned = false;
  toolbarPinned = true;
  clearTransientTimer();
  toolbar.className = "toolbar";
  toolbar.replaceChildren();
  toolbar.append(
    createIconButton("notebook-pen", t.note, () => showNoteEditor(element, id)),
  );
  toolbar.append(
    createIconButton("copy", t.copy, () =>
      navigator.clipboard.writeText(element.innerText),
    ),
  );
  toolbar.append(
    createIconButton("trash", t.delete, async () => {
      element.replaceWith(document.createTextNode(element.innerText));
      await sendMessage({ type: "DELETE_HIGHLIGHT", id });
      hideToolbar();
    }),
  );

  for (const color of Object.keys(HIGHLIGHT_COLORS) as HighlightColor[]) {
    const button = createIconButton(
      "circle",
      interpolate(t.changeToColor, { color }),
      async () => {
        element.style.background = HIGHLIGHT_COLORS[color];
        await sendMessage({ type: "UPDATE_HIGHLIGHT_COLOR", id, color });
      },
    );
    button.className = "color";
    button.title = color;
    button.style.background = HIGHLIGHT_COLORS[color];
    toolbar.append(button);
  }

  toolbar.classList.add("visible");
  trackToolbarAnchor(() =>
    element.isConnected ? element.getBoundingClientRect() : undefined,
  );
}

function showNoteEditor(element: HTMLElement, id: string): void {
  toolbar.classList.remove("visible");
  panelPinned = true;
  panel.className = "panel visible";
  panel.replaceChildren();
  const editor = document.createElement("div");
  editor.className = "note-editor";
  for (const eventType of EDITOR_ISOLATED_EVENT_TYPES) {
    editor.addEventListener(eventType, stopHostPageEvent);
  }
  const textarea = document.createElement("textarea");
  textarea.value = element.dataset.remarkerNote ?? "";
  textarea.setAttribute("aria-label", t.note);
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  const cancel = document.createElement("button");
  cancel.textContent = t.cancel;
  cancel.addEventListener("click", () => {
    panelPinned = false;
    panel.classList.remove("visible");
  });
  const save = document.createElement("button");
  save.textContent = t.save;
  save.addEventListener("click", async () => {
    const note = textarea.value.trim();
    await sendMessage({ type: "UPDATE_HIGHLIGHT_NOTE", id, note });
    setHighlightNote(element, note);
    panelPinned = false;
    panel.classList.remove("visible");
  });
  actions.append(cancel, save);
  editor.append(textarea, actions);
  panel.append(editor);
  positionPanel(element.getBoundingClientRect());
  textarea.focus();
  textarea.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancel.click();
  });
}

function stopHostPageEvent(event: Event): void {
  event.stopPropagation();
}

function setHighlightNote(element: HTMLElement, note?: string): void {
  const value = note?.trim() ?? "";
  if (value) {
    element.dataset.remarkerNote = value;
    const characters = Array.from(value);
    element.title = characters.length > 56 ? `${characters.slice(0, 56).join("")}…` : value;
    element.tabIndex = 0;
  } else {
    delete element.dataset.remarkerNote;
    element.removeAttribute("title");
    element.removeAttribute("tabindex");
    hideHighlightNoteTooltip();
  }
}

function showHighlightNoteTooltip(element: HTMLElement): void {
  const value = element.dataset.remarkerNote;
  if (!value || !noteTooltip) return;
  const characters = Array.from(value);
  noteTooltip.textContent = characters.length > 56
    ? `${characters.slice(0, 56).join("")}…`
    : value;
  noteTooltip.classList.add("visible");
  const rect = element.getBoundingClientRect();
  const tooltipRect = noteTooltip.getBoundingClientRect();
  noteTooltip.style.left = `${Math.min(
    Math.max(12, rect.left),
    window.innerWidth - tooltipRect.width - 12,
  )}px`;
  noteTooltip.style.top = `${Math.max(12, rect.top - tooltipRect.height - 8)}px`;
}

function hideHighlightNoteTooltip(): void {
  noteTooltip?.classList.remove("visible");
}

function getContextForRange(range: Range): string {
  const snapshot = getContextTextSnapshot(range);
  if (!snapshot) return range.toString().trim();

  return createSemanticContext({
    text: snapshot.text,
    selectionStart: snapshot.selectionStart,
    selectionEnd: snapshot.selectionEnd,
    maxLength: CONTEXT_CHAR_LIMIT,
  });
}

function getContextTextSnapshot(range: Range): ContextTextSnapshot | undefined {
  let text = "";
  let selectionStart: number | undefined;
  let selectionEnd: number | undefined;

  function appendBreak(): void {
    if (text && !text.endsWith("\n")) text += "\n";
  }

  function visit(node: Node): void {
    if (shouldIgnoreContextNode(node)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (textNode === range.startContainer) {
        selectionStart = text.length + range.startOffset;
      }
      if (textNode === range.endContainer) {
        selectionEnd = text.length + range.endOffset;
      }
      text += textNode.data;
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;

    if (element.tagName.toLowerCase() === "br") {
      appendBreak();
      return;
    }

    const isBlock = isContextBlockElement(element);
    if (isBlock) appendBreak();

    Array.from(element.childNodes).forEach((child, index) => {
      captureElementBoundaryOffset(element, index);
      visit(child);
    });
    captureElementBoundaryOffset(element, element.childNodes.length);

    if (isBlock) appendBreak();
  }

  function captureElementBoundaryOffset(
    element: Element,
    offset: number,
  ): void {
    if (range.startContainer === element && range.startOffset === offset) {
      selectionStart = text.length;
    }
    if (range.endContainer === element && range.endOffset === offset) {
      selectionEnd = text.length;
    }
  }

  visit(document.body);

  if (selectionStart === undefined || selectionEnd === undefined) {
    return undefined;
  }
  return { text, selectionStart, selectionEnd };
}

function shouldIgnoreContextNode(node: Node): boolean {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return Boolean(
    element?.closest(
      `#remarker-root, script, style, noscript, template, [hidden], [aria-hidden="true"]`,
    ),
  );
}

function isContextBlockElement(element: Element): boolean {
  return [
    "article",
    "aside",
    "blockquote",
    "dd",
    "div",
    "dl",
    "dt",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "ul",
  ].includes(element.tagName.toLowerCase());
}

function getBlockElement(node: Node): HTMLElement | null {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  return element?.closest(
    "p, li, blockquote, pre, code, article, section, div",
  ) as HTMLElement | null;
}

function getIntersectingBlocks(range: Range): HTMLElement[] {
  const blocks = Array.from(
    document.querySelectorAll<HTMLElement>(
      "p, li, blockquote, pre, article section, article div",
    ),
  );
  return blocks.filter((block) => {
    try {
      return range.intersectsNode(block) && block.innerText.trim();
    } catch {
      return false;
    }
  });
}

function getRangeRect(range: Range): DOMRect | undefined {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  return rects[0] ?? undefined;
}

function positionAboveSelection(
  element: HTMLElement,
  rect: DOMRect,
  gap: number,
): void {
  const isAnchorVisible =
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth;
  element.style.visibility = isAnchorVisible ? "" : "hidden";
  if (!isAnchorVisible) return;

  const top =
    toolbarPlacement === "above"
      ? rect.top - element.offsetHeight - gap
      : rect.bottom + gap;
  const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
  const left = Math.min(maxLeft, Math.max(8, rect.left));
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
}

function trackToolbarAnchor(getRect: () => DOMRect | undefined): void {
  toolbarAnchor = getRect;
  const rect = getRect();
  if (!rect) {
    toolbar.style.visibility = "hidden";
    return;
  }
  toolbarPlacement =
    rect.top - toolbar.offsetHeight - 8 >= 8 ? "above" : "below";
  positionAboveSelection(toolbar, rect, 8);
}

function scheduleToolbarPositionUpdate(): void {
  if (toolbarPositionFrame !== undefined) return;
  toolbarPositionFrame = window.requestAnimationFrame(() => {
    toolbarPositionFrame = undefined;
    updateToolbarPosition();
  });
}

function updateToolbarPosition(): void {
  if (!toolbar?.classList.contains("visible") || !toolbarAnchor) return;
  const rect = toolbarAnchor();
  if (!rect) {
    toolbar.style.visibility = "hidden";
    return;
  }
  positionAboveSelection(toolbar, rect, 8);
}

function positionPanel(selectionRect: DOMRect): void {
  const width = Math.min(420, window.innerWidth - 32);
  panel.style.width = `${width}px`;
  panel.style.left = `${Math.min(window.innerWidth - width - 16, Math.max(16, selectionRect.left))}px`;

  const height = panel.offsetHeight || 160;
  const topAbove = selectionRect.top - height - 10;
  const top =
    topAbove >= 8
      ? topAbove
      : Math.min(window.innerHeight - height - 8, selectionRect.bottom + 10);
  panel.style.top = `${Math.max(8, top)}px`;
}

function showTransientSuccess(rect: DOMRect): void {
  clearTransientTimer();
  panelPinned = false;
  toolbarPinned = true;
  panel.classList.remove("visible");
  toolbar.replaceChildren();
  toolbar.className = "toolbar visible success";
  const check = document.createElement("span");
  check.className = "success-icon";
  check.innerHTML = ICONS.check;
  toolbar.append(check);
  positionAboveSelection(toolbar, rect, 8);
  transientTimer = window.setTimeout(() => {
    hideToolbar();
  }, 600);
}

function showStatusPanel(text: string, isError: boolean): void {
  if (!currentSelection) return;
  panelPinned = false;
  toolbarPinned = false;
  panel.textContent = text;
  panel.className = `panel visible${isError ? " error" : ""}`;
  positionPanel(currentSelection.rect);
}

function showErrorPanel(error: unknown): void {
  const message = formatError(error);
  if (!isMissingLlmConfigError(message)) {
    showStatusPanel(message, true);
    return;
  }

  if (!currentSelection) return;
  panelPinned = false;
  toolbarPinned = false;
  panel.className = "panel visible error";
  panel.replaceChildren();
  panel.append(document.createTextNode(`${message} `));

  const link = document.createElement("button");
  link.type = "button";
  link.textContent = t.configureLlm;
  link.style.height = "auto";
  link.style.minWidth = "auto";
  link.style.padding = "0";
  link.style.color = "#00319d";
  link.style.background = "transparent";
  link.style.textDecoration = "underline";
  link.style.display = "inline";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void sendMessage({ type: "OPEN_SETTINGS_PAGE" }).catch((error) => {
      console.warn("[Remarker] failed to open settings", error);
    });
  });
  panel.append(link);
  positionPanel(currentSelection.rect);
}

function isMissingLlmConfigError(message: string): boolean {
  return (
    message === MISSING_LLM_CONFIG_ERROR ||
    message.includes("LLM configuration is missing")
  );
}

function showExplanationPanel(
  text: string,
  options: { isLoading: boolean },
): void {
  if (!currentSelection) return;
  panelPinned = true;
  toolbar.classList.remove("visible");
  panel.className = "panel visible";
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("span");
  title.textContent = getExplanationPanelTitle(options.isLoading);
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  actions.style.marginTop = "0";

  if (!options.isLoading) {
    const refreshButton = createIconButton("refresh", t.regenerate, () =>
      explainCurrentSelection(true),
    );
    actions.append(refreshButton);

    const copyExplanationButton = createIconButton(
      "copy",
      t.copyExplanation,
      async () => {
        await navigator.clipboard.writeText(text);
        showButtonSuccess(copyExplanationButton, "copy");
        if (autoCloseLookupPanelOnCopy) {
          window.setTimeout(() => {
            panelPinned = false;
            hideToolbar();
          }, 180);
        }
      },
    );
    actions.append(copyExplanationButton);
  }

  const close = createIconButton("x", t.close, () => {
    cancelActiveStream();
    panelPinned = false;
    hideToolbar();
  });
  actions.append(close);
  header.append(title, actions);

  const body = document.createElement("div");
  body.className = "panel-body markdown-body";
  if (options.isLoading) {
    body.append(createLoadingSkeleton());
  } else {
    body.innerHTML = markdownToSafeHtml(text);
  }

  panel.append(header, body);

  positionPanel(currentSelection.rect);
}

function createLoadingSkeleton(): HTMLElement {
  const container = document.createElement("div");
  container.className = "skeleton-stack";

  for (const className of ["long", "medium", "long", "short"]) {
    const line = document.createElement("div");
    line.className = `skeleton-line ${className}`;
    container.append(line);
  }

  return container;
}

function showLookupExplanationPanel(
  anchor: HTMLElement,
  record: VocabularyRecord,
): void {
  if (lookupPanelTimer !== undefined) {
    window.clearTimeout(lookupPanelTimer);
    lookupPanelTimer = undefined;
  }

  panelPinned = false;
  toolbarPinned = false;
  toolbar.classList.remove("visible");
  panel.className = "panel visible";
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "panel-header";
  const title = document.createElement("span");
  title.textContent = record.word;
  const actions = document.createElement("div");
  actions.className = "panel-actions";
  actions.style.marginTop = "0";
  const copyButton = createIconButton("copy", t.copyExplanation, async () => {
    await navigator.clipboard.writeText(record.translation ?? "");
    showButtonSuccess(copyButton, "copy");
  });
  actions.append(copyButton);
  header.append(title, actions);

  const body = document.createElement("div");
  body.className = "panel-body markdown-body";
  body.innerHTML = markdownToSafeHtml(record.translation || "");
  panel.append(header, body);

  panel.addEventListener("mouseenter", clearLookupPanelHideTimer, {
    once: true,
  });
  panel.addEventListener("mouseleave", scheduleLookupPanelHide, { once: true });
  positionPanel(anchor.getBoundingClientRect());
}

function clearLookupPanelHideTimer(): void {
  if (lookupPanelTimer !== undefined) {
    window.clearTimeout(lookupPanelTimer);
    lookupPanelTimer = undefined;
  }
}

function scheduleLookupPanelHide(): void {
  clearLookupPanelHideTimer();
  lookupPanelTimer = window.setTimeout(() => {
    panel.classList.remove("visible");
    lookupPanelTimer = undefined;
  }, 220);
}

function getExplanationPanelTitle(isLoading: boolean): string {
  if (currentSelection?.isWord) return isLoading ? t.explaining : t.explanation;
  return isLoading ? t.translating : t.translation;
}

function hideToolbar(): void {
  if (!toolbar || !panel) return;
  panelPinned = false;
  toolbarPinned = false;
  toolbarAnchor = undefined;
  if (toolbarPositionFrame !== undefined) {
    window.cancelAnimationFrame(toolbarPositionFrame);
    toolbarPositionFrame = undefined;
  }
  clearTransientTimer();
  clearLookupPanelHideTimer();
  toolbar.style.visibility = "";
  toolbar.classList.remove("visible");
  toolbar.classList.remove("success");
  panel.classList.remove("visible");
}

function containPanelWheel(event: WheelEvent): void {
  const target = event.target as HTMLElement;
  const scrollable = target.closest(".panel-body, .panel") as HTMLElement | null;
  if (!scrollable) return;
  const atTop = scrollable.scrollTop <= 0;
  const atBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;
  if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) event.preventDefault();
  event.stopPropagation();
}

function scheduleIdleRestore(): void {
  const run = () => {
    void restoreHighlights().then(restoreVocabularyMarkers).catch((error) => {
      console.warn("[Remarker] restore failed", error);
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    globalThis.setTimeout(run, 120);
  }
}

async function applyInIdleBatches<T>(
  items: T[],
  apply: (item: T) => void,
  batchSize = 40,
  shouldContinue: () => boolean = () => true,
): Promise<boolean> {
  for (let index = 0; index < items.length; index += batchSize) {
    if (!shouldContinue()) return false;
    items.slice(index, index + batchSize).forEach(apply);
    if (index + batchSize < items.length) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }
  return true;
}

function removeRemarkerDecorations(): void {
  const elements = [
    ...document.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`),
    ...document.querySelectorAll<HTMLElement>(`.${LOOKUP_CLASS}`),
  ].reverse();

  for (const element of elements) {
    unwrapElement(element);
  }
}

function unwrapElement(element: HTMLElement): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function handleDocumentMouseDown(event: MouseEvent): void {
  const target = event.composedPath()[0];
  if (target instanceof Node && shadowRoot.contains(target)) return;
  if (
    target instanceof HTMLElement &&
    target.closest(`.${LOOKUP_CLASS}`)
  ) {
    suppressSelectionChange();
    return;
  }
  if (target instanceof HTMLElement && target.closest(`.${HIGHLIGHT_CLASS}`)) {
    return;
  }
  if (panelPinned) return;
  if (toolbarPinned) {
    hideToolbar();
    return;
  }
  panel.classList.remove("visible");
}

function preserveSelectionInteraction(event: MouseEvent): void {
  const target = event.target;
  const isEditableTarget =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
  if (!isEditableTarget) {
    event.preventDefault();
    suppressSelectionChange();
  }
  event.stopPropagation();
}

function suppressSelectionChange(): void {
  suppressSelectionChangeUntil = Date.now() + 400;
}

function clearTransientTimer(): void {
  if (transientTimer !== undefined) {
    window.clearTimeout(transientTimer);
    transientTimer = undefined;
  }
}

function showButtonSuccess(
  button: HTMLButtonElement,
  restoreIcon: IconName,
): void {
  const previousTitle = button.title;
  button.innerHTML = ICONS.check;
  button.title = t.copied;
  button.setAttribute("aria-label", t.copied);
  button.classList.add("success");
  window.setTimeout(() => {
    button.innerHTML = ICONS[restoreIcon];
    button.title = previousTitle;
    button.setAttribute("aria-label", previousTitle);
    button.classList.remove("success");
  }, 2000);
}

function getDocumentText(): string {
  return getAnchorTextSnapshot().text;
}

function getPageTextForRestoreValidation(): string {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent || node.parentElement?.closest("#remarker-root")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let text = "";
  while (walker.nextNode()) text += (walker.currentNode as Text).data;
  return text;
}

function getAnchorTextSnapshot(): TextSnapshot {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.textContent) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest(`#remarker-root, .${HIGHLIGHT_CLASS}`))
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }
  return {
    nodes,
    text: nodes.map((node) => node.data).join(""),
  };
}

function getTextOffsetsForRange(
  range: Range,
  snapshot = getAnchorTextSnapshot(),
): { start: number; end: number } | undefined {
  const textNodes = snapshot.nodes;
  let position = 0;
  let start: number | undefined;
  let end: number | undefined;

  for (const node of textNodes) {
    const nextPosition = position + node.data.length;

    if (node === range.startContainer) {
      start = position + range.startOffset;
    }

    if (node === range.endContainer) {
      end = position + range.endOffset;
      break;
    }

    if (
      range.startContainer.nodeType === Node.ELEMENT_NODE &&
      range.startContainer.contains(node) &&
      start === undefined
    ) {
      start = position;
    }

    if (
      range.endContainer.nodeType === Node.ELEMENT_NODE &&
      range.endContainer.contains(node)
    ) {
      end = nextPosition;
    }

    position = nextPosition;
  }

  if (start === undefined || end === undefined || end < start) return undefined;
  return { start, end };
}

function normalizeUrlKey(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function sendMessage<T>(message: unknown): Promise<T> {
  return chrome.runtime
    .sendMessage(message)
    .then((response: RuntimeResponse<T>) => {
      if (!response?.ok)
        throw new Error(response?.error ?? "Extension request failed.");
      return response.result as T;
    });
}

function debounce(fn: () => void, delay: number): () => void {
  let timeoutId: number | undefined;
  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(fn, delay);
  };
}

function isRange(value: Range | undefined): value is Range {
  return Boolean(value);
}

function isRangeMatch(value: RangeMatch | undefined): value is RangeMatch {
  return Boolean(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function findExistingHighlightElementForRange(
  range: Range,
): HTMLElement | undefined {
  const startElement =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const endElement =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;

  const startHighlight = startElement?.closest<HTMLElement>(
    `.${HIGHLIGHT_CLASS}`,
  );
  const endHighlight = endElement?.closest<HTMLElement>(`.${HIGHLIGHT_CLASS}`);
  if (startHighlight && startHighlight === endHighlight) return startHighlight;

  const highlights = Array.from(
    document.querySelectorAll<HTMLElement>(`.${HIGHLIGHT_CLASS}`),
  );
  return highlights.find((highlight) => {
    try {
      return range.intersectsNode(highlight);
    } catch {
      return false;
    }
  });
}

function rangeIntersectsSelector(range: Range, selector: string): boolean {
  const startElement =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const endElement =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;

  if (startElement?.closest(selector) || endElement?.closest(selector))
    return true;

  return Array.from(document.querySelectorAll(selector)).some((element) => {
    try {
      return range.intersectsNode(element);
    } catch {
      return false;
    }
  });
}

function markdownToSafeHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        html.push(
          `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      closeList();
      const { html: tableHtml, nextIndex } = renderTable(lines, index);
      html.push(tableHtml);
      index = nextIndex - 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length + 2;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      closeList();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeList();
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("");
}

function renderTable(
  lines: string[],
  startIndex: number,
): { html: string; nextIndex: number } {
  const headerCells = splitTableRow(lines[startIndex]);
  const bodyRows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length && isTableRow(lines[index])) {
    bodyRows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const header = headerCells
    .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
    .join("");
  const body = bodyRows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  return {
    html: `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`,
    nextIndex: index,
  };
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return (
    isTableRow(lines[index]) && isTableDelimiterLine(lines[index + 1] ?? "")
  );
}

function isTableRow(line: string): boolean {
  return line.trim().includes("|");
}

function isTableDelimiterLine(line: string): boolean {
  const cells = splitTableRow(line);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderInlineMarkdown(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type IconName =
  | "book-plus"
  | "check"
  | "circle"
  | "copy"
  | "highlighter"
  | "notebook-pen"
  | "refresh"
  | "search"
  | "sparkles"
  | "trash"
  | "volume"
  | "x";

const ICONS: Record<IconName, string> = {
  "book-plus":
    '<svg viewBox="0 0 24 24"><path d="M12 7v6"/><path d="M9 10h6"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  circle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  highlighter:
    '<svg viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>',
  "notebook-pen":
    '<svg viewBox="0 0 24 24"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M18.4 2.6a2.17 2.17 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 8h5V3"/></svg>',
  search:
    '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24"><path d="M9.9 2.8 8.7 7l-4.2 1.2 4.2 1.2 1.2 4.2 1.2-4.2 4.2-1.2L11.1 7z"/><path d="M18.5 12.5 17.8 15l-2.5.7 2.5.7.7 2.5.7-2.5 2.5-.7-2.5-.7z"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  volume:
    '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};
