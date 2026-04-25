const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Index by mastery 0..5; value = ms until next review on a successful answer at that mastery. */
export const MASTERY_INTERVALS_MS = [
  1 * MINUTE,   // 0 → 1m
  10 * MINUTE,  // 1 → 10m
  1 * HOUR,     // 2 → 1h
  1 * DAY,      // 3 → 1d
  7 * DAY,      // 4 → 1w
  30 * DAY,     // 5 → 1mo
] as const;

export const MASTERY_MAX = 5;
export const MASTERY_MASTERED_THRESHOLD = 4;

export interface ComputeNextReviewArgs {
  mastery: number;
  isCorrect: boolean;
  markMastered: boolean;
  now: Date;
}

export interface ComputeNextReviewResult {
  mastery: number;
  nextReview: Date;
}

/**
 * Apply one practice answer to a word's mastery.
 * - markMastered=true: jump to mastery 4 (the threshold a teacher's "master N words"
 *   completion check uses), regardless of isCorrect.
 * - isCorrect=true: increment mastery (cap MASTERY_MAX).
 * - isCorrect=false: decrement mastery (floor 0).
 * Then schedule next review at now + MASTERY_INTERVALS_MS[newMastery].
 */
export function computeNextReview(args: ComputeNextReviewArgs): ComputeNextReviewResult {
  const { mastery, isCorrect, markMastered, now } = args;
  let newMastery: number;
  if (markMastered) {
    newMastery = MASTERY_MASTERED_THRESHOLD;
  } else if (isCorrect) {
    newMastery = Math.min(MASTERY_MAX, mastery + 1);
  } else {
    newMastery = Math.max(0, mastery - 1);
  }
  const nextReview = new Date(now.getTime() + MASTERY_INTERVALS_MS[newMastery]);
  return { mastery: newMastery, nextReview };
}
