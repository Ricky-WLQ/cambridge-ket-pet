import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/diagnose/week";
import { maybeMarkDiagnoseComplete } from "@/lib/diagnose/markComplete";
import {
  DIAGNOSE_SECTION_KINDS,
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
  WritingAnswers,
} from "@/lib/diagnose/types";

export const maxDuration = 60;

interface RouteCtx {
  params: Promise<{ sectionKind: string }>;
}

/**
 * POST /api/diagnose/me/section/[sectionKind]/submit
 *
 * Submits a section's answers (T20). For deterministic sections (Reading /
 * Listening / Vocab / Grammar) grading happens inline; for Writing the text
 * is stored and AI grading is deferred to /finalize (T21). Speaking is NOT
 * accepted by this route — clients submit speaking via the existing
 * /api/speaking/[attemptId]/submit route, which already runs the Akool
 * close + transcript reconciliation + scoring pipeline.
 *
 * Behavior:
 *  1. Auth → 401.
 *  2. Validate `sectionKind` is one of the 6 diagnose sections.
 *  3. SPEAKING short-circuit: 410 Gone with redirect message.
 *  4. Find current-week WeeklyDiagnose; load the section's TestAttempt.
 *      - 404 if the WeeklyDiagnose is missing or the section's attemptId
 *        is unset (caller must hit /start first).
 *  5. Idempotency: if the attempt's status is no longer IN_PROGRESS, return
 *     409 (already submitted/graded/abandoned). Re-submitting risks
 *     overwriting AI grading state.
 *  6. Per-section grading:
 *      - READING / LISTENING / VOCAB / GRAMMAR: grade inline → status=GRADED
 *      - WRITING: store text → status=SUBMITTED (AI grading deferred to /finalize)
 *  7. Update WeeklyDiagnose section status mirror, and recompute the overall
 *     status: if all 6 section statuses are now in {SUBMITTED, GRADED,
 *     AUTO_SUBMITTED}, transition WeeklyDiagnose.status → COMPLETE +
 *     completedAt = now() (this is the gate-release moment).
 *  8. Return `{ attemptId, status, scaledScore? }`.
 *
 * Why we don't AI-grade Writing inline:
 *  The Writing AI call takes ~10s and would block the submit response. The
 *  /finalize task (T21) calls all per-section AI graders in parallel, which
 *  is both faster end-to-end and cleaner failure-mode for the user (one
 *  retry button instead of six per-section retry flows). Inline grading
 *  also makes the section status transition harder — Writing would need a
 *  third "GRADING" status mirror, which the schema doesn't have.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  // ──── Step 1: Auth ────────────────────────────────────────────────
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // ──── Step 2: Validate sectionKind ───────────────────────────────
  const { sectionKind: rawKind } = await ctx.params;
  if (!(DIAGNOSE_SECTION_KINDS as readonly string[]).includes(rawKind)) {
    return NextResponse.json(
      { error: "Invalid sectionKind" },
      { status: 400 },
    );
  }
  const sectionKind = rawKind as DiagnoseSectionKind;

  // ──── Step 3: SPEAKING short-circuit ─────────────────────────────
  // Speaking submits flow through /api/speaking/[attemptId]/submit, which
  // already owns the Akool close + transcript reconciler + async scoring.
  // Returning 410 Gone with a clear message keeps the diagnose route
  // surface area uniform without forcing this handler to proxy a body it
  // doesn't understand.
  if (sectionKind === "SPEAKING") {
    return NextResponse.json(
      {
        error: "GONE",
        message:
          "Speaking sections submit via /api/speaking/{attemptId}/submit",
      },
      { status: 410 },
    );
  }

  // ──── Step 4: Parse body ─────────────────────────────────────────
  const bodyEnvelope = z.object({ answers: z.unknown() });
  let parsedBody: { answers: unknown };
  try {
    parsedBody = bodyEnvelope.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — expected { answers: ... }" },
      { status: 400 },
    );
  }

  // ──── Step 5: Find WeeklyDiagnose + section attempt ──────────────
  const weekStart = currentWeekStart();
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { test: { select: { payload: true, kind: true } } },
  });
  if (!wd) {
    return NextResponse.json(
      { error: "本周诊断尚未生成" },
      { status: 404 },
    );
  }
  if (wd.test?.kind !== "DIAGNOSE") {
    return NextResponse.json(
      { error: "Linked Test is not a DIAGNOSE row" },
      { status: 500 },
    );
  }

  const attemptId = pickAttemptId(wd, sectionKind);
  if (!attemptId) {
    return NextResponse.json(
      { error: "Section not started — call /start first" },
      { status: 404 },
    );
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, status: true },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.status !== "IN_PROGRESS") {
    return NextResponse.json(
      {
        error: "Section already submitted",
        status: attempt.status,
      },
      { status: 409 },
    );
  }

  // ──── Step 6: Per-section grading ────────────────────────────────
  // The Test.payload is typed as `Json` by Prisma; cast to the structured
  // DiagnosePayload shape (the generate route is the only writer and it
  // follows this shape). The graders are pure and section-scoped, so this
  // cast is contained.
  const payload = wd.test.payload as unknown as DiagnosePayload;
  const submittedAt = new Date();

  if (sectionKind === "WRITING") {
    // Writing: store text, mark SUBMITTED. AI grading deferred to /finalize.
    const writingSchema = z.object({ text: z.string() });
    let writingBody: { text: string };
    try {
      writingBody = writingSchema.parse(parsedBody.answers);
    } catch {
      return NextResponse.json(
        { error: "Writing answers must be { text: string }" },
        { status: 400 },
      );
    }
    const answersJson: WritingAnswers = {
      sectionKind: "WRITING",
      text: writingBody.text,
    };
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "SUBMITTED",
        submittedAt,
        answers: answersJson as unknown as Prisma.InputJsonValue,
      },
    });
    await updateSectionStatusMirror(wd.id, sectionKind, "SUBMITTED");
    await maybeMarkDiagnoseComplete(wd.id);
    return NextResponse.json({
      attemptId: attempt.id,
      status: "SUBMITTED",
    });
  }

  // Auto-graded sections — branch on sectionKind to pick the right grader
  // + answers shape + content slice from the parent payload.
  let grade: SectionGradeResult;
  let answersJson:
    | ReadingAnswers
    | ListeningAnswers
    | VocabAnswers
    | GrammarAnswers;
  try {
    switch (sectionKind) {
      case "READING": {
        const sch = z.object({
          answers: z.array(z.number().int().nullable()),
        });
        const a = sch.parse(parsedBody.answers);
        const content: DiagnoseReadingContent = payload.sections.READING;
        answersJson = { sectionKind: "READING", answers: a.answers };
        grade = gradeReadingSection(content, answersJson);
        break;
      }
      case "LISTENING": {
        const sch = z.object({
          answers: z.array(z.number().int().nullable()),
        });
        const a = sch.parse(parsedBody.answers);
        const content: DiagnoseListeningContent = payload.sections.LISTENING;
        answersJson = { sectionKind: "LISTENING", answers: a.answers };
        grade = gradeListeningSection(content, answersJson);
        break;
      }
      case "VOCAB": {
        const sch = z.object({
          answers: z.array(z.string().nullable()),
        });
        const a = sch.parse(parsedBody.answers);
        const content: DiagnoseVocabContent = payload.sections.VOCAB;
        answersJson = { sectionKind: "VOCAB", answers: a.answers };
        grade = gradeVocabSection(content, answersJson);
        break;
      }
      case "GRAMMAR": {
        const sch = z.object({
          answers: z.array(z.number().int().nullable()),
        });
        const a = sch.parse(parsedBody.answers);
        const content: DiagnoseGrammarContent = payload.sections.GRAMMAR;
        answersJson = { sectionKind: "GRAMMAR", answers: a.answers };
        grade = gradeGrammarSection(content, answersJson);
        break;
      }
      default: {
        const _exhaustive: never = sectionKind;
        void _exhaustive;
        return NextResponse.json(
          { error: "Unhandled sectionKind" },
          { status: 500 },
        );
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid answers shape for section" },
      { status: 400 },
    );
  }

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "GRADED",
      submittedAt,
      answers: answersJson as unknown as Prisma.InputJsonValue,
      rawScore: grade.rawScore,
      totalPossible: grade.totalPossible,
      scaledScore: grade.scaledScore,
      weakPoints: grade.perItem as unknown as Prisma.InputJsonValue,
    },
  });
  await updateSectionStatusMirror(wd.id, sectionKind, "GRADED");
  await maybeMarkDiagnoseComplete(wd.id);

  // ──── Step 8: Return ─────────────────────────────────────────────
  return NextResponse.json({
    attemptId: attempt.id,
    status: "GRADED",
    scaledScore: grade.scaledScore,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Read the per-section attemptId off a WeeklyDiagnose row. */
function pickAttemptId(
  wd: {
    readingAttemptId: string | null;
    listeningAttemptId: string | null;
    writingAttemptId: string | null;
    speakingAttemptId: string | null;
    vocabAttemptId: string | null;
    grammarAttemptId: string | null;
  },
  sectionKind: DiagnoseSectionKind,
): string | null {
  switch (sectionKind) {
    case "READING":
      return wd.readingAttemptId;
    case "LISTENING":
      return wd.listeningAttemptId;
    case "WRITING":
      return wd.writingAttemptId;
    case "SPEAKING":
      return wd.speakingAttemptId;
    case "VOCAB":
      return wd.vocabAttemptId;
    case "GRAMMAR":
      return wd.grammarAttemptId;
    default: {
      const _exhaustive: never = sectionKind;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Update the WeeklyDiagnose row's per-section status mirror. Six explicit
 * branches because Prisma's typed update API doesn't allow string-keyed
 * dynamic field names.
 */
async function updateSectionStatusMirror(
  wdId: string,
  sectionKind: DiagnoseSectionKind,
  newStatus: "SUBMITTED" | "GRADED" | "AUTO_SUBMITTED",
): Promise<void> {
  switch (sectionKind) {
    case "READING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { readingStatus: newStatus },
      });
      return;
    case "LISTENING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { listeningStatus: newStatus },
      });
      return;
    case "WRITING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { writingStatus: newStatus },
      });
      return;
    case "SPEAKING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { speakingStatus: newStatus },
      });
      return;
    case "VOCAB":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { vocabStatus: newStatus },
      });
      return;
    case "GRAMMAR":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: { grammarStatus: newStatus },
      });
      return;
    default: {
      const _exhaustive: never = sectionKind;
      void _exhaustive;
    }
  }
}

// `maybeMarkComplete` was extracted to ``@/lib/diagnose/markComplete`` so the
// speaking submit route (which mirrors `WeeklyDiagnose.speakingStatus` from
// a separate code path) can call the same recompute. See that module's
// docstring for the rationale.
