import type { Messages } from "../shared/i18n";
import type { RuntimeMessage } from "../shared/messages";
import type { HighlightStatus } from "../shared/types";
import type { TabKey } from "./types";

const PROMPT_REQUIRED_VARIABLES = ["{{selection}}", "{{context}}"] as const;

export function getTabLabel(tab: TabKey, t: Messages): string {
  return {
    footprints: t.options.tabs.footprints,
    highlights: t.options.tabs.highlights,
    vocabulary: t.options.tabs.vocabulary,
    translations: t.options.tabs.translations,
    settings: t.options.tabs.settings,
    about: t.options.tabs.about,
  }[tab];
}

export function getInitialTab(): TabKey {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0];
  if (hash === "vocabulary-review") return "vocabulary";
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

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function sortByCreatedAtDesc<T extends { createdAt: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function getHighlightStatusDescription(
  status: HighlightStatus,
  t: Messages,
): string {
  return t.options.statusDescriptions[status];
}

export function includesFuzzy(
  value: string | undefined,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return (value ?? "").toLowerCase().includes(normalizedQuery);
}

export function getSourceSearchKeyword(value: string): string {
  return value.trim().slice(0, 24);
}

export function getMissingPromptVariables(promptTemplate: string): string[] {
  return PROMPT_REQUIRED_VARIABLES.filter(
    (variable) => !promptTemplate.includes(variable),
  );
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : "Operation failed.";
}

export function sendMessage<T>(message: RuntimeMessage): Promise<T> {
  return chrome.runtime
    .sendMessage(message)
    .then((response: { ok: boolean; result?: T; error?: string }) => {
      if (!response?.ok) {
        throw new Error(response?.error ?? "Extension request failed.");
      }
      return response.result as T;
    });
}
