import { describe, expect, it } from "vitest";
import {
  getNextReviewReminderAt,
  getReviewDayCutoff,
  getTodayReviewProgress,
  isVocabularyDue,
  normalizeVocabularyReview,
  REVIEW_REMINDER_HOUR,
  scheduleVocabularyReview,
} from "../review";
import type { VocabularyRecord } from "../types";

const record = normalizeVocabularyReview({
  id: "v1",
  word: "test",
  normalizedWord: "test",
  urlKey: "https://example.com",
  sourceUrl: "https://example.com",
  sourceTitle: "Example",
  contextSentence: "A test.",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

describe("SM-2 review scheduling", () => {
  it("normalizes a legacy vocabulary record", () => {
    const expectedNextReview = new Date(record.createdAt);
    expectedNextReview.setDate(expectedNextReview.getDate() + 1);
    expectedNextReview.setHours(REVIEW_REMINDER_HOUR, 0, 0, 0);

    expect(record).toMatchObject({
      reviewCount: 0,
      easinessFactor: 2.5,
      reviewIntervalDays: 0,
      nextReviewAt: expectedNextReview.toISOString(),
    });
  });

  it("starts reviewing a new word at 08:00 on the next local day", () => {
    const createdAt = new Date(record.createdAt);
    const beforeFirstReview = new Date(createdAt);
    beforeFirstReview.setDate(beforeFirstReview.getDate() + 1);
    beforeFirstReview.setHours(REVIEW_REMINDER_HOUR - 1, 59, 59, 999);
    const firstReviewAt = new Date(createdAt);
    firstReviewAt.setDate(firstReviewAt.getDate() + 1);
    firstReviewAt.setHours(REVIEW_REMINDER_HOUR, 0, 0, 0);

    expect(isVocabularyDue(record, beforeFirstReview.toISOString())).toBe(false);
    expect(isVocabularyDue(record, firstReviewAt.toISOString())).toBe(true);
  });

  it("schedules the reminder for the next local 08:00", () => {
    const beforeEight = new Date(2026, 7, 1, 7, 30);
    const todayAtEight = new Date(2026, 7, 1, REVIEW_REMINDER_HOUR);
    const atEight = new Date(2026, 7, 1, REVIEW_REMINDER_HOUR);
    const tomorrowAtEight = new Date(2026, 7, 2, REVIEW_REMINDER_HOUR);

    expect(getNextReviewReminderAt(beforeEight.toISOString())).toBe(
      todayAtEight.toISOString(),
    );
    expect(getNextReviewReminderAt(atEight.toISOString())).toBe(
      tomorrowAtEight.toISOString(),
    );
  });

  it("uses the next local midnight as the exclusive review-day cutoff", () => {
    const duringDay = new Date(2026, 7, 1, 14, 30, 45);
    const tomorrow = new Date(2026, 7, 2, 0, 0, 0, 0);

    expect(getReviewDayCutoff(duringDay.toISOString())).toBe(
      tomorrow.toISOString(),
    );
  });

  it("combines completed and still-pending words into today's review total", () => {
    const now = new Date(2026, 7, 2, 12);
    const yesterday = new Date(2026, 7, 1, 9).toISOString();
    const laterToday = new Date(2026, 7, 2, 18).toISOString();
    const completedToday = new Date(2026, 7, 2, 10).toISOString();
    const tomorrow = new Date(2026, 7, 3, 9).toISOString();
    const records = [
      { ...record, id: "completed", lastReviewAt: completedToday, nextReviewAt: tomorrow },
      { ...record, id: "pending-today", nextReviewAt: laterToday },
      { ...record, id: "overdue", nextReviewAt: yesterday },
      { ...record, id: "future", nextReviewAt: tomorrow },
      {
        ...record,
        id: "translation",
        selectionKind: "text" as const,
        lastReviewAt: completedToday,
        nextReviewAt: yesterday,
      },
    ];

    expect(getTodayReviewProgress(records, now.toISOString())).toEqual({
      completed: 1,
      pending: 2,
      total: 3,
    });
  });

  it("aligns an unreviewed legacy word to 08:00 on the same local date", () => {
    const legacyReviewAt = new Date(2026, 7, 2, 14, 30);
    const expectedReviewAt = new Date(2026, 7, 2, REVIEW_REMINDER_HOUR);
    const normalized = normalizeVocabularyReview({
      ...record,
      nextReviewAt: legacyReviewAt.toISOString(),
    });

    expect(normalized.nextReviewAt).toBe(expectedReviewAt.toISOString());
  });

  it("preserves the precise next-review time of a reviewed word", () => {
    const preciseReviewAt = new Date(2026, 7, 2, 14, 37, 12, 345);
    const normalized = normalizeVocabularyReview({
      ...record,
      reviewCount: 1,
      reviewIntervalDays: 1,
      lastReviewAt: new Date(2026, 7, 1, 14, 37, 12, 345).toISOString(),
      nextReviewAt: preciseReviewAt.toISOString(),
    });

    expect(normalized.nextReviewAt).toBe(preciseReviewAt.toISOString());
  });

  it("uses one then six days for passing reviews", () => {
    const firstReviewedAt = new Date(2026, 7, 1, 14, 37, 12, 345);
    const secondReviewedAt = new Date(2026, 7, 2, 16, 12, 34, 567);
    const first = scheduleVocabularyReview(
      record,
      "hesitant",
      firstReviewedAt.toISOString(),
    );
    const second = scheduleVocabularyReview(
      first,
      "skilled",
      secondReviewedAt.toISOString(),
    );
    const expectedFirstReview = new Date(firstReviewedAt);
    expectedFirstReview.setDate(expectedFirstReview.getDate() + 1);
    const expectedSecondReview = new Date(secondReviewedAt);
    expectedSecondReview.setDate(expectedSecondReview.getDate() + 6);
    expect(first.reviewCount).toBe(1);
    expect(first.reviewIntervalDays).toBe(1);
    expect(second.reviewCount).toBe(2);
    expect(second.reviewIntervalDays).toBe(6);
    expect(first.nextReviewAt).toBe(expectedFirstReview.toISOString());
    expect(second.nextReviewAt).toBe(expectedSecondReview.toISOString());
  });

  it("resets an unfamiliar word and clamps easiness", () => {
    let current: VocabularyRecord = { ...record, easinessFactor: 1.3, reviewCount: 4 };
    current = scheduleVocabularyReview(current, "unfamiliar", "2026-08-01T00:00:00.000Z");
    expect(current.reviewCount).toBe(0);
    expect(current.reviewIntervalDays).toBe(1);
    expect(current.easinessFactor).toBe(1.3);
  });

  it("keeps translation records outside the review calendar", () => {
    const translation = normalizeVocabularyReview({
      ...record,
      selectionKind: "text",
      nextReviewAt: undefined,
    });
    expect(translation.nextReviewAt).toBe("9999-12-31T23:59:59.999Z");
  });

  it("overrides an invalid due date on imported translation records", () => {
    const translation = normalizeVocabularyReview({
      ...record,
      selectionKind: "text",
      nextReviewAt: "2020-01-01T00:00:00.000Z",
    });
    expect(translation.nextReviewAt).toBe("9999-12-31T23:59:59.999Z");
  });

  it("expands later intervals using the updated easiness factor", () => {
    const first = scheduleVocabularyReview(record, "skilled", "2026-08-01T12:00:00.000Z");
    const second = scheduleVocabularyReview(first, "skilled", "2026-08-02T12:00:00.000Z");
    const third = scheduleVocabularyReview(second, "skilled", "2026-08-08T12:00:00.000Z");
    const expectedNextReview = new Date("2026-08-08T12:00:00.000Z");
    expectedNextReview.setDate(
      expectedNextReview.getDate() + third.reviewIntervalDays,
    );
    expect(third.reviewCount).toBe(3);
    expect(third.reviewIntervalDays).toBeGreaterThan(6);
    expect(third.nextReviewAt).toBe(expectedNextReview.toISOString());
  });
});
