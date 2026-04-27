import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { maybeMarkDiagnoseComplete } from "@/lib/diagnose/markComplete";
import {
  isCronExpired,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import {
  gradeReadingSection,
  gradeListeningSection,
  gradeVocabSection,
  gradeGrammarSection,
  type SectionGradeResult,
} from "@/lib/diagnose/grade";
import type {
  DiagnoseGrammarContent,
  DiagnoseListeningContent,
  DiagnosePayload,
  DiagnoseReadingContent,
  DiagnoseVocabContent,
  GrammarAnswers,
  ListeningAnswers,
  ReadingAnswers,
  VocabAnswers,
} from "@/lib/diagnose/types";

/**
 * Cron helper: scan IN_PROGRESS DIAGNOSE TestAttempt rows and force-submit
 * the ones whose section's deadline + GRACE_SEC has passed. Mirrors the
 * pattern in /api/cron/expired-attempts (Task 34) but for the diagnose-v2
 * runner's per-section deadlines.
 *
 * Per-section behavior:
 *  - READING / LISTENING / VOCAB / GRAMMAR: grade with whatever (possibly
 *    empty) answers the user has saved → status=GRADED, mirror=AUTO_SUBMITTED.
 *    Empty answers grade to scaledScore=0 deterministically.
 *  - WRITING: store `weakPoints={ error: "auto_submitted_unanswered", ... }`
 *    + scaledScore=0, status=SUBMITTED, mirror=AUTO_SUBMITTED. The /finalize
 *    route's gating logic accepts SUBMITTED in the "finished" set so the
 *    section won't block report generation.
 *  - SPEAKING: speaking-status pipeline owns the lifecycle for that row.
 *    We mark mirror=AUTO_SUBMITTED on the WeeklyDiagnose only, and write
 *    a `weakPoints.error` flag on the attempt for finalize to pick up.
 *
 * Idempotency:
 *  - Only IN_PROGRESS attempts are picked up. Once we transition them to
 *    GRADED/SUBMITTED, subsequent ticks will skip them.
 *  - The mirror update is direct (no readback first) — re-running is a
 *    no-op write.
 *
 * Discriminator note:
 *  - The runner stores `{ sectionKind, ... }` in TestAttempt.answers as a
 *    discriminator since the same Test row hosts 6 attempts with different
 *    schemas. We extract the discriminator to choose the per-section grader.
 *    If the discriminator is missing (shouldn't happen — start route always
 *    seeds it), we skip the row defensively.
 */
export async function forceSubmitExpiredDiagnoseSections(
  now: Date = new Date(),
): Promise<{ forcedSubmitted: number; reapedAudio: number }> {
  // Find IN_PROGRESS attempts whose parent Test.kind is DIAGNOSE.
  // We don't filter by startedAt at the DB layer because the time-limit is
  // section-specific (varies 240s to 900s) and the cleanest correctness
  // check lives in `isCronExpired` which knows the DiagnoseSectionKind.
  // The candidate set is tiny (a few hundred at most across all active
  // diagnoses) so per-row evaluation is fine.
  const candidates = await prisma.testAttempt.findMany({
    where: {
      status: "IN_PROGRESS",
      test: { kind: "DIAGNOSE" },
    },
    include: { test: true },
  });

  let count = 0;
  for (const attempt of candidates) {
    const ans = attempt.answers as { sectionKind?: string; replay?: boolean } | null;
    const sectionKindStr = ans?.sectionKind;
    if (!sectionKindStr) continue;

    // Replay attempts (created by /api/diagnose/replay) carry replay:true
    // and are deliberately invisible to the gate. We don't force-submit
    // them — the user can abandon and re-replay later without consequence.
    if (ans.replay === true) continue;

    if (
      sectionKindStr !== "READING" &&
      sectionKindStr !== "LISTENING" &&
      sectionKindStr !== "WRITING" &&
      sectionKindStr !== "SPEAKING" &&
      sectionKindStr !== "VOCAB" &&
      sectionKindStr !== "GRAMMAR"
    ) {
      continue;
    }
    const sectionKind = sectionKindStr as DiagnoseSectionKind;

    if (!isCronExpired(sectionKind, attempt.startedAt, now)) continue;

    // Resolve the WeeklyDiagnose row from testId so we can mirror status.
    const wd = await prisma.weeklyDiagnose.findUnique({
      where: { testId: attempt.testId },
      select: { id: true },
    });
    if (!wd) continue; // Orphan attempt — skip.

    const payload = attempt.test.payload as unknown as DiagnosePayload;

    if (sectionKind === "READING") {
      const userAnswers = extractMcqAnswers(attempt.answers);
      const content: DiagnoseReadingContent = payload.sections.READING;
      const answersJson: ReadingAnswers = {
        sectionKind: "READING",
        answers: userAnswers,
      };
      const grade = gradeReadingSection(content, answersJson);
      await applyGradedSection(attempt.id, wd.id, sectionKind, answersJson, grade, now);
      count++;
      continue;
    }

    if (sectionKind === "LISTENING") {
      const userAnswers = extractMcqAnswers(attempt.answers);
      const content: DiagnoseListeningContent = payload.sections.LISTENING;
      const answersJson: ListeningAnswers = {
        sectionKind: "LISTENING",
        answers: userAnswers,
      };
      const grade = gradeListeningSection(content, answersJson);
      await applyGradedSection(attempt.id, wd.id, sectionKind, answersJson, grade, now);
      count++;
      continue;
    }

    if (sectionKind === "VOCAB") {
      const userAnswers = extractStringAnswers(attempt.answers);
      const content: DiagnoseVocabContent = payload.sections.VOCAB;
      const answersJson: VocabAnswers = {
        sectionKind: "VOCAB",
        answers: userAnswers,
      };
      const grade = gradeVocabSection(content, answersJson);
      await applyGradedSection(attempt.id, wd.id, sectionKind, answersJson, grade, now);
      count++;
      continue;
    }

    if (sectionKind === "GRAMMAR") {
      const userAnswers = extractMcqAnswers(attempt.answers);
      const content: DiagnoseGrammarContent = payload.sections.GRAMMAR;
      const answersJson: GrammarAnswers = {
        sectionKind: "GRAMMAR",
        answers: userAnswers,
      };
      const grade = gradeGrammarSection(content, answersJson);
      await applyGradedSection(attempt.id, wd.id, sectionKind, answersJson, grade, now);
      count++;
      continue;
    }

    if (sectionKind === "WRITING") {
      // Writing was never submitted by the user; mark the attempt SUBMITTED
      // with a sentinel weakPoints.error so finalize can surface that this
      // section auto-expired (no AI grading attempt will be made — finalize
      // skips writing AI grading when scaledScore is already non-null).
      const writingAnswers = (attempt.answers as { text?: string } | null);
      const text = typeof writingAnswers?.text === "string" ? writingAnswers.text : "";
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt: now,
          answers: {
            sectionKind: "WRITING",
            text,
          } as Prisma.InputJsonValue,
          rawScore: 0,
          totalPossible: 20,
          scaledScore: 0,
          weakPoints: {
            error: "auto_submitted_unanswered",
          } as Prisma.InputJsonValue,
        },
      });
      await mirrorAutoSubmitted(wd.id, sectionKind);
      // C3: release the gate when this auto-submit closes the last section.
      await maybeMarkDiagnoseComplete(wd.id);
      count++;
      continue;
    }

    if (sectionKind === "SPEAKING") {
      // Speaking has its own lifecycle (Akool session + transcript +
      // async scoring). We can't simulate that pipeline from the cron, so
      // we just flag the attempt and mirror AUTO_SUBMITTED on the
      // WeeklyDiagnose. /finalize already tolerates speaking that never
      // reached SCORED (writes weakPoints.error="speaking_score_pending"
      // mirror, proceeds with null sub-score).
      await prisma.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt: now,
          weakPoints: {
            error: "auto_submitted_unanswered",
          } as Prisma.InputJsonValue,
        },
      });
      await mirrorAutoSubmitted(wd.id, sectionKind);
      // C3: release the gate when this auto-submit closes the last section.
      await maybeMarkDiagnoseComplete(wd.id);
      count++;
      continue;
    }

    // Exhaustiveness — the if-chain above covers all 6 kinds, so this is
    // unreachable. Defensive `never` cast keeps TS strict-checking honest
    // if a 7th SectionKind is added.
    const _exhaustive: never = sectionKind;
    void _exhaustive;
  }

  // I6: stuck-audio reaper. Diagnose Test rows whose listening TTS pipeline
  // never wrote a terminal status (audioStatus stays "GENERATING" past 10
  // minutes) are force-marked FAILED with a sentinel reason so the listening
  // section runner can show an explicit error instead of a forever-spinning
  // "preparing audio" placeholder. Threshold is conservative — typical
  // Edge-TTS render takes 30-90s.
  const TEN_MIN_MS = 10 * 60_000;
  const stuckAudio = await prisma.test.findMany({
    where: {
      kind: "DIAGNOSE",
      audioStatus: "GENERATING",
      audioGenStartedAt: { lt: new Date(now.getTime() - TEN_MIN_MS) },
    },
    select: { id: true },
  });
  let reapedAudio = 0;
  for (const test of stuckAudio) {
    await prisma.test.update({
      where: { id: test.id },
      data: {
        audioStatus: "FAILED",
        audioErrorMessage: "Audio generation timed out (>10min)",
        audioGenCompletedAt: now,
      },
    });
    reapedAudio++;
  }

  return { forcedSubmitted: count, reapedAudio };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Extract a `(number|null)[]` from `attempt.answers.answers` for MCQ
 * sections. The runner saves draft answers in the same shape the submit
 * route accepts, so we can reuse it directly. Missing → empty array.
 */
function extractMcqAnswers(answersJson: unknown): (number | null)[] {
  const root = answersJson as { answers?: unknown } | null;
  if (!root || !Array.isArray(root.answers)) return [];
  return root.answers.map((a) => (typeof a === "number" ? a : null));
}

/**
 * Extract a `(string|null)[]` from `attempt.answers.answers` for the Vocab
 * fill-blank section. Same draft-shape contract as MCQ.
 */
function extractStringAnswers(answersJson: unknown): (string | null)[] {
  const root = answersJson as { answers?: unknown } | null;
  if (!root || !Array.isArray(root.answers)) return [];
  return root.answers.map((a) => (typeof a === "string" ? a : null));
}

/**
 * Apply a graded section: update the TestAttempt to GRADED, persist the
 * (rawScore, totalPossible, scaledScore, weakPoints=perItem[]) fields the
 * finalize step will read, and flip the WeeklyDiagnose mirror to
 * AUTO_SUBMITTED. Also fires `maybeMarkDiagnoseComplete` so the gate
 * releases the user once the cron pulls the last outstanding section
 * across the line (C3).
 */
async function applyGradedSection(
  attemptId: string,
  wdId: string,
  sectionKind: DiagnoseSectionKind,
  answersJson:
    | ReadingAnswers
    | ListeningAnswers
    | VocabAnswers
    | GrammarAnswers,
  grade: SectionGradeResult,
  now: Date,
): Promise<void> {
  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: "GRADED",
      submittedAt: now,
      answers: answersJson as unknown as Prisma.InputJsonValue,
      rawScore: grade.rawScore,
      totalPossible: grade.totalPossible,
      scaledScore: grade.scaledScore,
      weakPoints: grade.perItem as unknown as Prisma.InputJsonValue,
    },
  });
  await mirrorAutoSubmitted(wdId, sectionKind);
  await maybeMarkDiagnoseComplete(wdId);
}

/**
 * Update WeeklyDiagnose's per-section status mirror to AUTO_SUBMITTED.
 * Six explicit branches because Prisma's typed update API doesn't allow
 * string-keyed dynamic field names.
 */
async function mirrorAutoSubmitted(
  wdId: string,
  sectionKind: DiagnoseSectionKind,
): Promise<void> {
  switch (sectionKind) {
    case "READING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { readingStatus: "AUTO_SUBMITTED" },
      });
      return;
    case "LISTENING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { listeningStatus: "AUTO_SUBMITTED" },
      });
      return;
    case "WRITING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { writingStatus: "AUTO_SUBMITTED" },
      });
      return;
    case "SPEAKING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { speakingStatus: "AUTO_SUBMITTED" },
      });
      return;
    case "VOCAB":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { vocabStatus: "AUTO_SUBMITTED" },
      });
      return;
    case "GRAMMAR":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { grammarStatus: "AUTO_SUBMITTED" },
      });
      return;
    default: {
      const _exhaustive: never = sectionKind;
      void _exhaustive;
    }
  }
}
