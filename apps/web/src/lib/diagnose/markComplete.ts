/**
 * Shared "all 6 sections done?" recompute helper, used by both:
 *   - /api/diagnose/me/section/[sectionKind]/submit (T20) for the
 *     deterministic R/L/W/V/G section submits
 *   - /api/speaking/[attemptId]/submit (Phase 3) for diagnose-mode
 *     speaking attempts (which mirror onto WeeklyDiagnose.speakingStatus)
 *
 * Background
 * ----------
 * A WeeklyDiagnose row mirrors per-section completion onto six
 * ``DiagnoseSectionStatus`` columns (readingStatus, listeningStatus,
 * writingStatus, speakingStatus, vocabStatus, grammarStatus). When all
 * six are in {SUBMITTED, GRADED, AUTO_SUBMITTED} the parent row's
 * ``status`` should transition to ``COMPLETE`` and ``completedAt`` is
 * stamped — that's the gate-release moment that lets ``requireUngated``
 * unblock /ket and /pet pages.
 *
 * Two distinct submit pipelines write to the section status mirrors:
 *   1. The diagnose section submit route, which handles R/L/W/V/G inline
 *      and writing's two-phase grade (SUBMITTED at submit, GRADED later
 *      after /finalize runs the AI graders).
 *   2. The speaking pipeline, which reuses the existing
 *      /api/speaking/[attemptId]/submit endpoint (transcript reconcile +
 *      Akool close + async scoring) and mirrors a flip into
 *      ``speakingStatus`` from a separate code path.
 *
 * Both paths must call this helper after updating their section's mirror
 * column so the gate releases as soon as the LAST section finishes
 * regardless of which path got there last.
 *
 * Idempotency
 * -----------
 * The helper short-circuits when the row is already in a terminal status
 * (``COMPLETE``, ``REPORT_READY``, ``REPORT_FAILED``), so callers can
 * fire it freely without coordinating "who's the last one".
 */

import { prisma } from "@/lib/prisma";

/**
 * Recompute ``WeeklyDiagnose.status`` based on its 6 section-status mirror
 * columns. Sets ``status = COMPLETE`` + ``completedAt = now()`` iff:
 *   - The row exists.
 *   - All 6 section statuses are in {SUBMITTED, GRADED, AUTO_SUBMITTED}.
 *   - The row's current status is not already in {COMPLETE, REPORT_READY,
 *     REPORT_FAILED} (idempotent — never moves backwards).
 *
 * No-op in all other cases. Safe to call multiple times for the same row.
 */
export async function maybeMarkDiagnoseComplete(
  weeklyDiagnoseId: string,
): Promise<void> {
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { id: weeklyDiagnoseId },
    select: {
      readingStatus: true,
      listeningStatus: true,
      writingStatus: true,
      speakingStatus: true,
      vocabStatus: true,
      grammarStatus: true,
      status: true,
    },
  });
  if (!wd) return;

  // Already terminal — never reset COMPLETE → COMPLETE (avoids a useless
  // write) and never overwrite a REPORT_READY/REPORT_FAILED row that
  // /finalize already advanced past COMPLETE.
  if (
    wd.status === "COMPLETE" ||
    wd.status === "REPORT_READY" ||
    wd.status === "REPORT_FAILED"
  ) {
    return;
  }

  const finishedSet: Set<string> = new Set([
    "SUBMITTED",
    "GRADED",
    "AUTO_SUBMITTED",
  ]);
  const allDone =
    finishedSet.has(wd.readingStatus) &&
    finishedSet.has(wd.listeningStatus) &&
    finishedSet.has(wd.writingStatus) &&
    finishedSet.has(wd.speakingStatus) &&
    finishedSet.has(wd.vocabStatus) &&
    finishedSet.has(wd.grammarStatus);

  if (!allDone) return;

  await prisma.weeklyDiagnose.update({
    where: { id: weeklyDiagnoseId },
    data: { status: "COMPLETE", completedAt: new Date() },
  });
}
