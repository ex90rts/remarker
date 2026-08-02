import type { HighlightRecord, VocabularyRecord } from "./types";

export const ACTIVITY_LEVEL_COLORS = [
  "#eff2f5",
  "#aceebb",
  "#4ac26b",
  "#2da44e",
  "#116329",
] as const;

export interface DailyActivity {
  highlights: number;
  vocabulary: number;
  translations: number;
  total: number;
}

export function buildDailyActivity(
  highlights: HighlightRecord[],
  vocabulary: VocabularyRecord[],
): Record<string, DailyActivity> {
  const activity: Record<string, DailyActivity> = {};

  for (const highlight of highlights) {
    incrementActivity(activity, highlight.createdAt, "highlights");
  }
  for (const record of vocabulary) {
    incrementActivity(
      activity,
      record.createdAt,
      record.selectionKind === "text" ? "translations" : "vocabulary",
    );
  }

  return activity;
}

export function getActivityColor(count: number): string {
  if (count <= 0) return ACTIVITY_LEVEL_COLORS[0];
  if (count <= 3) return ACTIVITY_LEVEL_COLORS[1];
  if (count <= 8) return ACTIVITY_LEVEL_COLORS[2];
  if (count < 16) return ACTIVITY_LEVEL_COLORS[3];
  return ACTIVITY_LEVEL_COLORS[4];
}

export function getLocalDateKey(value: string | Date): string | undefined {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function incrementActivity(
  activity: Record<string, DailyActivity>,
  createdAt: string,
  kind: "highlights" | "vocabulary" | "translations",
): void {
  const dateKey = getLocalDateKey(createdAt);
  if (!dateKey) return;
  const day = activity[dateKey] ?? {
    highlights: 0,
    vocabulary: 0,
    translations: 0,
    total: 0,
  };
  day[kind] += 1;
  day.total += 1;
  activity[dateKey] = day;
}
