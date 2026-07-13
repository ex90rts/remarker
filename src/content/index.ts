import {
  createSemanticContext,
  DEFAULT_CONTEXT_CHAR_LIMIT,
} from "../shared/context";

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

interface ExplanationRecord {
  id: string;
  selectionKind?: "word" | "text";
  selectedText: string;
  sourceUrl: string;
  anchor?: TextAnchor;
  result: string;
  createdAt: string;
}

interface VocabularyRecord {
  id: string;
  word: string;
  sourceUrl: string;
  anchor?: TextAnchor;
  translation?: string;
  createdAt: string;
}

interface ContentMessages {
  copy: string;
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
}

const CONTENT_MESSAGES: Record<SupportedLanguage, ContentMessages> = {
  "zh-CN": {
    copy: "复制",
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
  },
  "zh-TW": {
    copy: "複製",
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
  },
  en: {
    copy: "Copy",
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
  },
  es: {
    copy: "Copiar",
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
  },
};

const MISSING_LLM_CONFIG_ERROR = "LLM configuration is incomplete.";

const WORD_PATTERN = /^[A-Za-z]+(?:[-'][A-Za-z]+)*$/;
const HIGHLIGHT_CLASS = "remarker-highlight";
const LOOKUP_CLASS = "remarker-lookup";
const LOOKUP_UNDERLINE_COLOR = "#f97316";
const CONTEXT_CHAR_LIMIT = DEFAULT_CONTEXT_CHAR_LIMIT;
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
let currentSelection: SelectionState | undefined;
let currentUrlKey = normalizeUrlKey(location.href);
let panelPinned = false;
let toolbarPinned = false;
let suppressSelectionChangeUntil = 0;
let transientTimer: number | undefined;
let lookupPanelTimer: number | undefined;
let t: ContentMessages = getContentMessages(detectBrowserLanguage());
let autoCloseLookupPanelOnCopy = false;

init().catch((error) => {
  console.warn("[Remarker] init failed", error);
});

async function init(): Promise<void> {
  if (!(await isEnabledForCurrentPage())) return;

  await loadMessages();
  createOverlay();
  await restoreHighlights();
  await restoreLookupExplanations();

  document.addEventListener(
    "selectionchange",
    debounce(handleSelectionChange, 120),
  );
  document.addEventListener("mousedown", handleDocumentMouseDown, true);
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

function createOverlay(): void {
  const host = document.createElement("div");
  host.id = "remarker-root";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "2147483647";
  document.documentElement.append(host);

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
      border: 1px solid rgba(15, 23, 42, 0.16);
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
      border-radius: 8px;
      display: none;
      z-index: 2147483647;
    }
    .toolbar {
      gap: 4px;
      padding: 6px;
      align-items: center;
    }
    .toolbar.visible { display: flex; }
    .panel {
      width: min(420px, calc(100vw - 32px));
      max-height: 360px;
      overflow: auto;
      padding: 12px;
      font-size: 13px;
      line-height: 1.55;
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
  `;

  toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  panel = document.createElement("div");
  panel.className = "panel";
  toolbar.addEventListener("mousedown", preserveSelectionInteraction);
  panel.addEventListener("mousedown", preserveSelectionInteraction);
  shadowRoot.append(style, toolbar, panel);
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
    isWord: WORD_PATTERN.test(text),
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
  positionAboveSelection(toolbar, selection.rect, 8);
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

async function speakSelection(): Promise<void> {
  if (!currentSelection) return;

  const response = await sendMessage<{ provider: string; audioUrl?: string }>({
    type: "GET_PRONUNCIATION",
    word: currentSelection.text,
  });

  if (response.audioUrl) {
    await new Audio(response.audioUrl).play();
    return;
  }

  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(currentSelection.text));
}

async function explainCurrentSelection(forceRefresh: boolean): Promise<void> {
  if (!currentSelection) return;

  const anchor = createTextAnchor(currentSelection.range);
  suppressSelectionChange();
  showExplanationPanel(
    currentSelection.isWord ? t.explainingProgress : t.translatingProgress,
    { isLoading: true },
  );
  const explanation = await sendMessage<ExplanationRecord>({
    type: "EXPLAIN_SELECTION",
    selectionKind: currentSelection.isWord ? "word" : "text",
    selectedText: currentSelection.text,
    context: getContextForRange(currentSelection.range),
    sourceUrl: location.href,
    sourceTitle: document.title,
    anchor,
    forceRefresh,
  });

  showExplanationPanel(explanation.result, { isLoading: false });
  if (currentSelection.isWord) {
    applyLookupMarkers([
      {
        id: explanation.id,
        word: explanation.selectedText,
        sourceUrl: explanation.sourceUrl,
        anchor: explanation.anchor ?? anchor,
        translation: explanation.result,
        createdAt: explanation.createdAt,
      },
    ]);
  }
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

async function restoreHighlights(): Promise<void> {
  currentUrlKey = normalizeUrlKey(location.href);
  const records = await sendMessage<HighlightRecord[]>({
    type: "GET_HIGHLIGHTS_FOR_URL",
    urlKey: currentUrlKey,
  });
  const snapshot = getAnchorTextSnapshot();
  const restorePlan: Array<{ record: HighlightRecord; match: RangeMatch }> = [];

  for (const record of records) {
    const matches = findRangeMatchesForAnchor(record.anchor, snapshot);
    if (matches.length === 1) {
      restorePlan.push({ record, match: matches[0] });
      if (record.status !== "active") {
        await sendMessage({
          type: "UPDATE_HIGHLIGHT_STATUS",
          id: record.id,
          status: "active",
        });
      }
    } else {
      const status: HighlightStatus =
        matches.length === 0 ? "not_found" : "ambiguous";
      if (record.status !== status) {
        await sendMessage({
          type: "UPDATE_HIGHLIGHT_STATUS",
          id: record.id,
          status,
        });
      }
    }
  }

  restorePlan
    .sort((left, right) => right.match.start - left.match.start)
    .forEach(({ record, match }) => {
      wrapRange(match.range, record.color, record.id);
    });
}

async function restoreLookupExplanations(): Promise<void> {
  const records = await sendMessage<VocabularyRecord[]>({
    type: "GET_VOCABULARY_FOR_URL",
    urlKey: currentUrlKey,
  });
  applyLookupMarkers(records);
}

function applyLookupMarkers(records: VocabularyRecord[]): void {
  const snapshot = getAnchorTextSnapshot();
  const plan: Array<{
    record: VocabularyRecord;
    match: RangeMatch;
  }> = [];

  for (const record of records) {
    if (!record.anchor) continue;
    const matches = findRangeMatchesForAnchor(record.anchor, snapshot);
    if (matches.length !== 1) continue;
    const [match] = matches;
    if (rangeIntersectsSelector(match.range, `.${LOOKUP_CLASS}`)) continue;
    plan.push({ record, match });
  }

  plan
    .sort((left, right) => right.match.start - left.match.start)
    .forEach(({ record, match }) => {
      wrapLookupRange(match.range, record);
    });
}

function wrapLookupRange(range: Range, record: VocabularyRecord): void {
  if (rangeIntersectsSelector(range, `.${LOOKUP_CLASS}`)) return;

  const wrapper = document.createElement("span");
  wrapper.className = LOOKUP_CLASS;
  wrapper.dataset.remarkerExplanationId = record.id;
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

function wrapRange(range: Range, color: HighlightColor, id: string): void {
  const wrapper = document.createElement("mark");
  wrapper.className = HIGHLIGHT_CLASS;
  wrapper.dataset.remarkerId = id;
  wrapper.style.background = HIGHLIGHT_COLORS[color];
  wrapper.style.borderRadius = "3px";
  wrapper.style.padding = "0 1px";
  wrapper.addEventListener("click", (event) => {
    event.stopPropagation();
    suppressSelectionChange();
    renderExistingHighlightToolbar(wrapper, id);
  });
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
}

function renderExistingHighlightToolbar(
  element: HTMLElement,
  id: string,
): void {
  panelPinned = false;
  toolbarPinned = true;
  clearTransientTimer();
  toolbar.className = "toolbar";
  toolbar.replaceChildren();
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
  positionAboveSelection(toolbar, element.getBoundingClientRect(), 8);
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

  function captureElementBoundaryOffset(element: Element, offset: number): void {
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
  const top = Math.max(8, rect.top - element.offsetHeight - gap);
  const left = Math.min(window.innerWidth - 16, Math.max(8, rect.left));
  element.style.top = `${top}px`;
  element.style.left = `${left}px`;
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
  }, 2000);
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
  return message === MISSING_LLM_CONFIG_ERROR;
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
  panelPinned = false;
  toolbarPinned = false;
  clearTransientTimer();
  clearLookupPanelHideTimer();
  toolbar.classList.remove("visible");
  toolbar.classList.remove("success");
  panel.classList.remove("visible");
}

function handleDocumentMouseDown(event: MouseEvent): void {
  const target = event.composedPath()[0];
  if (target instanceof Node && shadowRoot.contains(target)) return;
  if (
    target instanceof HTMLElement &&
    target.closest(`.${HIGHLIGHT_CLASS}, .${LOOKUP_CLASS}`)
  ) {
    suppressSelectionChange();
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
  event.preventDefault();
  event.stopPropagation();
  suppressSelectionChange();
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
  | "refresh"
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
  refresh:
    '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M16 8h5V3"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24"><path d="M9.9 2.8 8.7 7l-4.2 1.2 4.2 1.2 1.2 4.2 1.2-4.2 4.2-1.2L11.1 7z"/><path d="M18.5 12.5 17.8 15l-2.5.7 2.5.7.7 2.5.7-2.5 2.5-.7-2.5-.7z"/></svg>',
  trash:
    '<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  volume:
    '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
};
