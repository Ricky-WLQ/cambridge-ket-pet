/**
 * Cambridge 2020-format listening paper timings.
 * Source: KET + PET official sample tape scripts (see spec §3.4).
 */
export const PAUSE_SEC = {
  BEFORE_REPEAT: 5,
  BETWEEN_ITEMS: 2,
  INTER_PART: 10,
  PRE_PART_INSTRUCTION: 5,
  TRANSFER_BLOCK_PREAMBLE: 300,
  TRANSFER_BLOCK_FINAL: 60,
  BETWEEN_LINES: 0.5,
  SHORT: 1,
} as const;

export type PauseKey = keyof typeof PAUSE_SEC;

/**
 * Part-specific preview (reading) time per Cambridge spec.
 * Keyed by (examType, partNumber).
 */
export const PREVIEW_SEC: Record<"KET" | "PET", Record<number, number>> = {
  KET: { 1: 5, 2: 10, 3: 20, 4: 5, 5: 15 },
  PET: { 1: 5, 2: 8, 3: 20, 4: 45 },
};
