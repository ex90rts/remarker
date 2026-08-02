import type { VocabularyRecord } from "./types";

export type ReviewRating = "unfamiliar" | "hesitant" | "skilled";

export interface TodayReviewProgress {
  completed: number;
  pending: number;
  total: number;
}

export const DEFAULT_EASINESS_FACTOR = 2.5;
export const MIN_EASINESS_FACTOR = 1.3;
export const REVIEW_REMINDER_HOUR = 8;
const NON_REVIEWABLE_DATE = "9999-12-31T23:59:59.999Z";

const QUALITY_BY_RATING: Record<ReviewRating, number> = {
  unfamiliar: 1,
  hesitant: 3,
  skilled: 5,
};

export function normalizeVocabularyReview(
  record: Omit<VocabularyRecord, "reviewCount" | "easinessFactor" | "reviewIntervalDays" | "nextReviewAt"> &
    Partial<Pick<VocabularyRecord, "reviewCount" | "easinessFactor" | "reviewIntervalDays" | "nextReviewAt">>,
): VocabularyRecord {
  const selectionKind = record.selectionKind ?? "word";
  const reviewCount = Math.max(0, Math.trunc(record.reviewCount ?? 0));
  const reviewIntervalDays = Math.max(
    0,
    Math.trunc(record.reviewIntervalDays ?? 0),
  );
  const isNewWord =
    selectionKind === "word" &&
    reviewCount === 0 &&
    reviewIntervalDays === 0 &&
    !record.lastReviewAt;
  const nextReviewAt =
    selectionKind === "text"
      ? NON_REVIEWABLE_DATE
      : record.nextReviewAt
        ? isNewWord
          ? getReviewAtLocalMorning(record.nextReviewAt, 0)
          : record.nextReviewAt
        : getFirstReviewAt(record.createdAt);
  return {
    ...record,
    selectionKind,
    reviewCount,
    easinessFactor: Math.max(
      MIN_EASINESS_FACTOR,
      record.easinessFactor ?? DEFAULT_EASINESS_FACTOR,
    ),
    reviewIntervalDays,
    nextReviewAt,
  } as VocabularyRecord;
}

export function scheduleVocabularyReview(
  source: VocabularyRecord,
  rating: ReviewRating,
  reviewedAt: string,
): VocabularyRecord {
  const record = normalizeVocabularyReview(source);
  const quality = QUALITY_BY_RATING[rating];
  const easinessFactor = Math.max(
    MIN_EASINESS_FACTOR,
    record.easinessFactor +
      (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const passed = quality >= 3;
  const reviewCount = passed ? record.reviewCount + 1 : 0;
  const reviewIntervalDays = passed
    ? reviewCount === 1
      ? 1
      : reviewCount === 2
        ? 6
        : Math.max(1, Math.round(record.reviewIntervalDays * easinessFactor))
    : 1;

  return {
    ...record,
    reviewCount,
    easinessFactor,
    reviewIntervalDays,
    lastReviewAt: reviewedAt,
    nextReviewAt: addLocalCalendarDays(reviewedAt, reviewIntervalDays),
    updatedAt: reviewedAt,
  };
}

export function isVocabularyDue(record: VocabularyRecord, now: string): boolean {
  return (record.selectionKind ?? "word") === "word" &&
    normalizeVocabularyReview(record).nextReviewAt <= now;
}

export function getNextReviewReminderAt(now: string): string {
  const date = parseReviewTimestamp(now);
  const reminder = new Date(date);
  reminder.setHours(REVIEW_REMINDER_HOUR, 0, 0, 0);
  if (reminder <= date) reminder.setDate(reminder.getDate() + 1);
  return reminder.toISOString();
}

export function getReviewDayCutoff(now: string): string {
  const cutoff = parseReviewTimestamp(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() + 1);
  return cutoff.toISOString();
}

export function getTodayReviewProgress(
  records: VocabularyRecord[],
  now: string,
): TodayReviewProgress {
  const todayStart = parseReviewTimestamp(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const completedIds = new Set<string>();
  const pendingIds = new Set<string>();

  for (const record of records) {
    if ((record.selectionKind ?? "word") !== "word") continue;
    if (
      record.lastReviewAt &&
      isTimestampInRange(record.lastReviewAt, todayStart, tomorrowStart)
    ) {
      completedIds.add(record.id);
    }
    const nextReviewAt = new Date(record.nextReviewAt);
    if (
      !Number.isNaN(nextReviewAt.getTime()) &&
      nextReviewAt < tomorrowStart
    ) {
      pendingIds.add(record.id);
    }
  }

  return {
    completed: completedIds.size,
    pending: pendingIds.size,
    total: new Set([...completedIds, ...pendingIds]).size,
  };
}

function getReviewAtLocalMorning(value: string, days: number): string {
  const date = parseReviewTimestamp(value);
  date.setDate(date.getDate() + days);
  date.setHours(REVIEW_REMINDER_HOUR, 0, 0, 0);
  return date.toISOString();
}

function addLocalCalendarDays(value: string, days: number): string {
  const date = parseReviewTimestamp(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getFirstReviewAt(value: string): string {
  const date = parseReviewTimestamp(value);
  date.setDate(date.getDate() + 1);
  date.setHours(REVIEW_REMINDER_HOUR, 0, 0, 0);
  return date.toISOString();
}

function parseReviewTimestamp(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid review timestamp.");
  return date;
}

function isTimestampInRange(value: string, start: Date, end: Date): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date >= start && date < end;
}
