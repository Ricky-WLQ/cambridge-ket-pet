import { describe, expect, it } from "vitest";
import { computeNextReview, MASTERY_INTERVALS_MS } from "./srs";

describe("MASTERY_INTERVALS_MS", () => {
  it("has 6 entries covering mastery 0..5", () => {
    expect(MASTERY_INTERVALS_MS).toHaveLength(6);
  });

  it("intervals are 1m, 10m, 1h, 1d, 1w, 1mo", () => {
    const m = 60_000;
    const h = 60 * m;
    const d = 24 * h;
    expect(MASTERY_INTERVALS_MS).toEqual([
      1 * m, 10 * m, 1 * h, 1 * d, 7 * d, 30 * d,
    ]);
  });
});

describe("computeNextReview", () => {
  const now = new Date("2026-04-26T12:00:00Z");

  it("on correct: increments mastery and sets nextReview to now + interval[newMastery]", () => {
    const result = computeNextReview({ mastery: 0, isCorrect: true, markMastered: false, now });
    expect(result.mastery).toBe(1);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 10 * 60_000);
  });

  it("on correct at mastery 5: holds at 5 with 1mo nextReview", () => {
    const result = computeNextReview({ mastery: 5, isCorrect: true, markMastered: false, now });
    expect(result.mastery).toBe(5);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 30 * 24 * 60 * 60_000);
  });

  it("on wrong: decrements mastery (floor 0) and sets nextReview to now + interval[newMastery]", () => {
    const result = computeNextReview({ mastery: 3, isCorrect: false, markMastered: false, now });
    expect(result.mastery).toBe(2);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 60 * 60_000);
  });

  it("on wrong at mastery 0: stays at 0", () => {
    const result = computeNextReview({ mastery: 0, isCorrect: false, markMastered: false, now });
    expect(result.mastery).toBe(0);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 60_000);
  });

  it("on markMastered: jumps to mastery 4 with 1w nextReview", () => {
    const result = computeNextReview({ mastery: 1, isCorrect: true, markMastered: true, now });
    expect(result.mastery).toBe(4);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60_000);
  });

  // I1 — regression: markMastered must win over isCorrect=false
  it("markMastered wins over isCorrect=false (jumps to 4, not decrement)", () => {
    const result = computeNextReview({ mastery: 3, isCorrect: false, markMastered: true, now });
    expect(result.mastery).toBe(4);
    expect(result.nextReview.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60_000);
  });

  // I2 — full 6 mastery × 3 outcomes matrix per spec §6.7
  describe("full mastery × outcome matrix (6 × 3 = 18 cases per spec §6.7)", () => {
    type Outcome = "correct" | "wrong" | "markMastered";
    const intervals = [60_000, 600_000, 3_600_000, 86_400_000, 604_800_000, 2_592_000_000];

    function expectedNewMastery(start: number, outcome: Outcome): number {
      if (outcome === "markMastered") return 4;
      if (outcome === "correct") return Math.min(5, start + 1);
      return Math.max(0, start - 1);
    }

    const cases: Array<{ start: number; outcome: Outcome }> = [];
    for (let m = 0; m <= 5; m++) {
      for (const o of ["correct", "wrong", "markMastered"] as const) {
        cases.push({ start: m, outcome: o });
      }
    }

    it.each(cases)("mastery=$start, outcome=$outcome", ({ start, outcome }) => {
      const result = computeNextReview({
        mastery: start,
        isCorrect: outcome !== "wrong",
        markMastered: outcome === "markMastered",
        now,
      });
      const expected = expectedNewMastery(start, outcome);
      expect(result.mastery).toBe(expected);
      expect(result.nextReview.getTime()).toBe(now.getTime() + intervals[expected]);
    });
  });

  // S3 — defensive clamp: out-of-range input doesn't crash
  describe("defensive clamp for drifted DB values", () => {
    it("mastery=7 + correct → clamped to 5, holds at 5", () => {
      const result = computeNextReview({ mastery: 7, isCorrect: true, markMastered: false, now });
      expect(result.mastery).toBe(5);
      expect(result.nextReview.getTime()).toBe(now.getTime() + 30 * 24 * 60 * 60_000);
    });

    it("mastery=7 + wrong → clamped to 5 then decremented to 4 (not undefined!)", () => {
      const result = computeNextReview({ mastery: 7, isCorrect: false, markMastered: false, now });
      expect(result.mastery).toBe(4);
      expect(result.nextReview.getTime()).toBe(now.getTime() + 7 * 24 * 60 * 60_000);
      expect(Number.isFinite(result.nextReview.getTime())).toBe(true);
    });

    it("mastery=-3 + wrong → clamped to 0, stays at 0", () => {
      const result = computeNextReview({ mastery: -3, isCorrect: false, markMastered: false, now });
      expect(result.mastery).toBe(0);
      expect(result.nextReview.getTime()).toBe(now.getTime() + 60_000);
    });
  });
});
