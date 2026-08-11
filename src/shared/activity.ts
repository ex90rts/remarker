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
  reviews?: number;
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
    const reviewTimes = record.reviewHistory?.length
      ? record.reviewHistory
      : record.lastReviewAt
        ? [record.lastReviewAt]
        : [];
    for (const reviewedAt of reviewTimes) {
      incrementActivity(activity, reviewedAt, "reviews", false);
    }
  }

  for (const day of Object.values(activity)) {
    day.total += getReviewActivityScore(day.reviews ?? 0);
  }

  return activity;
}

export function getActivityColor(count: number): string {
  if (count <= 0) return ACTIVITY_LEVEL_COLORS[0];
  if (count <= 3) return ACTIVITY_LEVEL_COLORS[1];
  if (count <= 8) return ACTIVITY_LEVEL_COLORS[2];
  if (count <= 15) return ACTIVITY_LEVEL_COLORS[3];
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
  kind: "highlights" | "vocabulary" | "translations" | "reviews",
  contributesToTotal = true,
): void {
  const dateKey = getLocalDateKey(createdAt);
  if (!dateKey) return;
  const day = activity[dateKey] ?? {
    highlights: 0,
    vocabulary: 0,
    translations: 0,
    total: 0,
  };
  day[kind] = (day[kind] ?? 0) + 1;
  if (contributesToTotal) day.total += 1;
  activity[dateKey] = day;
}

export function getReviewActivityScore(reviewCount: number): number {
  return Math.min(10, Math.max(0, Math.ceil(Math.max(0, reviewCount) / 5)));
}
