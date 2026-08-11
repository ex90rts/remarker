import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVEL_COLORS,
  buildDailyActivity,
  getActivityColor,
  getReviewActivityScore,
  getLocalDateKey,
} from "../activity";
import type { HighlightRecord, VocabularyRecord } from "../types";

describe("daily learning activity", () => {
  it("combines highlights, vocabulary, and translations by local date", () => {
    const firstDay = new Date(2026, 7, 1, 9).toISOString();
    const secondDay = new Date(2026, 7, 2, 9).toISOString();
    const highlights = [
      { createdAt: firstDay },
      { createdAt: firstDay },
    ] as HighlightRecord[];
    const vocabulary = [
      { createdAt: firstDay, selectionKind: "word" },
      { createdAt: firstDay, selectionKind: "text" },
      { createdAt: secondDay, selectionKind: undefined },
    ] as VocabularyRecord[];

    const activity = buildDailyActivity(highlights, vocabulary);

    expect(activity[getLocalDateKey(firstDay)!]).toEqual({
      highlights: 2,
      vocabulary: 1,
      translations: 1,
      total: 4,
    });
    expect(activity[getLocalDateKey(secondDay)!]).toEqual({
      highlights: 0,
      vocabulary: 1,
      translations: 0,
      total: 1,
    });
  });

  it("uses the requested five color levels", () => {
    expect([0, 1, 3, 4, 8, 9, 15, 16, 99].map(getActivityColor)).toEqual([
      ACTIVITY_LEVEL_COLORS[0],
      ACTIVITY_LEVEL_COLORS[1],
      ACTIVITY_LEVEL_COLORS[1],
      ACTIVITY_LEVEL_COLORS[2],
      ACTIVITY_LEVEL_COLORS[2],
      ACTIVITY_LEVEL_COLORS[3],
      ACTIVITY_LEVEL_COLORS[3],
      ACTIVITY_LEVEL_COLORS[4],
      ACTIVITY_LEVEL_COLORS[4],
    ]);
  });

  it("ignores records with invalid creation timestamps", () => {
    const activity = buildDailyActivity(
      [{ createdAt: "invalid" } as HighlightRecord],
      [],
    );

    expect(activity).toEqual({});
  });

  it("scores review volume in five-word steps while retaining raw counts", () => {
    const reviewedAt = new Date(2026, 7, 3, 9).toISOString();
    const vocabulary = [
      ...Array.from({ length: 18 }, (_, index) => ({
        createdAt: new Date(2026, 7, 1, 9 + index).toISOString(),
        selectionKind: "word",
        reviewHistory: [reviewedAt],
      })),
    ] as VocabularyRecord[];
    const activity = buildDailyActivity([], vocabulary);
    expect(activity[getLocalDateKey(reviewedAt)!].reviews).toBe(18);
    expect(activity[getLocalDateKey(reviewedAt)!].total).toBe(4);
    expect(getReviewActivityScore(0)).toBe(0);
    expect(getReviewActivityScore(18)).toBe(4);
    expect(getReviewActivityScore(100)).toBe(10);
  });
});
