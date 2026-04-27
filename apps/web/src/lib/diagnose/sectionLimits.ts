/**
 * Per-section time limits for the weekly diagnose runner.
 *
 * Why these constants exist:
 *  - The runner UI uses `remainingSec` to drive the on-screen countdown.
 *  - The submit route uses `isExpired` as a server-side guard so a stale
 *    client tab cannot submit a section after its time window has closed.
 *  - The cron force-submit-expired job uses `isCronExpired` (limit + grace)
 *    to absorb client-clock drift before auto-finalizing a stuck section.
 *
 * Values come from the v2 plan, Section C.1.6:
 *   Reading 8m / Listening 10m / Writing 15m / Speaking 5m / Vocab 4m / Grammar 5m
 *
 * The 60s grace window matters because:
 *  - Client clocks can drift up to ~tens of seconds vs the server clock.
 *  - We want the client-side timer + submit guard to fire on the exact
 *    deadline (no slack), but the cron should NOT race the submit-route
 *    on the very edge of expiry — hence cron uses `limit + 60s`.
 */

/** Section kinds eligible for the diagnose. Excludes MOCK_FULL/MOCK_SECTION/DIAGNOSE itself. */
export type DiagnoseSectionKind =
  | "READING"
  | "LISTENING"
  | "WRITING"
  | "SPEAKING"
  | "VOCAB"
  | "GRAMMAR";

/** Per-section time limit in seconds for the diagnose runner. Indexed by TestKind. */
export const SECTION_TIME_LIMIT_SEC = {
  READING: 480,
  LISTENING: 600,
  WRITING: 900,
  SPEAKING: 300,
  VOCAB: 240,
  GRAMMAR: 300,
} as const satisfies Record<DiagnoseSectionKind, number>;

/** Grace window in seconds — cron force-submits only after limit + grace has elapsed since startedAt. */
export const GRACE_SEC = 60;

/**
 * The 6 section kinds that compose a weekly diagnose. Order matters for UI display
 * and matches the plan's Section A.4 ordering of the 6 attempt FK + status mirror columns.
 */
export const DIAGNOSE_SECTION_KINDS: readonly DiagnoseSectionKind[] = [
  "READING",
  "LISTENING",
  "WRITING",
  "SPEAKING",
  "VOCAB",
  "GRAMMAR",
] as const;

/** Compute the deadline (without grace) for a started section. */
export function deadlineFor(kind: DiagnoseSectionKind, startedAt: Date): Date {
  return new Date(startedAt.getTime() + SECTION_TIME_LIMIT_SEC[kind] * 1000);
}

/** Compute the cron-eligible deadline (limit + grace) for a started section. */
export function cronDeadlineFor(
  kind: DiagnoseSectionKind,
  startedAt: Date,
): Date {
  return new Date(
    startedAt.getTime() + (SECTION_TIME_LIMIT_SEC[kind] + GRACE_SEC) * 1000,
  );
}

/** Has the section's primary deadline (no grace) passed? Used by client-side timer + submit-route validator. */
export function isExpired(
  kind: DiagnoseSectionKind,
  startedAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= deadlineFor(kind, startedAt).getTime();
}

/** Has the cron-eligible deadline (limit + grace) passed? Used only by the force-submit-expired cron. */
export function isCronExpired(
  kind: DiagnoseSectionKind,
  startedAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= cronDeadlineFor(kind, startedAt).getTime();
}

/** Seconds remaining before the primary deadline. Returns 0 if already expired. Used for UI countdown. */
export function remainingSec(
  kind: DiagnoseSectionKind,
  startedAt: Date,
  now: Date = new Date(),
): number {
  const remainingMs = deadlineFor(kind, startedAt).getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return Math.floor(remainingMs / 1000);
}
