import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { maybeMarkDiagnoseComplete } from "@/lib/diagnose/markComplete";
import { closeAkoolSession } from "@/lib/speaking/akool-client";
import { clearTurns, readTurns } from "@/lib/speaking/turn-buffer";
import {
  reconcileTranscript,
  type ClientTranscriptTurn,
  type TranscriptTurn,
} from "@/lib/speaking/transcript-reconciler";
import { scoreSpeakingAttempt } from "@/lib/speaking/scoring-client";

const clientTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  part: z.number().int().min(1).max(6),
  ts: z.string(),
  source: z.enum(["akool_stt", "client_fallback"]),
});

const bodySchema = z.object({
  clientTranscript: z.array(clientTurnSchema).default([]),
});

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Idempotency: once we're past IN_PROGRESS, no-op.
  if (attempt.speakingStatus !== "IN_PROGRESS") {
    return NextResponse.json({ ok: true });
  }

  // Fire-and-forget the Akool close (best-effort; session will time out
  // on the Akool side anyway).
  if (attempt.akoolSessionId) {
    closeAkoolSession(attempt.akoolSessionId).catch((err) =>
      console.warn("akool session/close failed (ignored)", err),
    );
  }

  const serverBuffer = readTurns(attemptId);
  const clientBuffer = body.clientTranscript as ClientTranscriptTurn[];
  const transcript = reconcileTranscript({ serverBuffer, clientBuffer });

  if (transcript.length === 0) {
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "ABANDONED",
        speakingStatus: "FAILED",
        speakingError: "No transcript captured",
      },
    });
    clearTurns(attemptId);
    // Diagnose mirror — even an empty-transcript attempt counts as
    // "section finished" for gate-release, otherwise the user is stuck
    // forever. Mirror as AUTO_SUBMITTED to flag the abnormal exit.
    await mirrorOntoDiagnose(attempt.testId, "AUTO_SUBMITTED");
    return NextResponse.json({ ok: true });
  }

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      // Mirror speaking-specific status onto the legacy AttemptStatus
      // so /history filters, teacher views, and the per-student
      // aggregates (which key off `status === "GRADED"` etc.) treat
      // speaking attempts the same as reading/writing/listening.
      status: "SUBMITTED",
      speakingStatus: "SUBMITTED",
      transcript: transcript as unknown as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });
  clearTurns(attemptId);

  // Diagnose mirror — for diagnose attempts, flip
  // ``WeeklyDiagnose.speakingStatus`` to SUBMITTED and re-evaluate the
  // overall complete-state. This is what releases the gate when speaking
  // is the last section to finish. Async scoring will later flip the
  // mirror to GRADED via ``runScoringInBackground``.
  await mirrorOntoDiagnose(attempt.testId, "SUBMITTED");

  // Fire scoring asynchronously. We return to the client now; the
  // /status endpoint will surface SCORING -> SCORED / FAILED.
  void runScoringInBackground(attempt.id, attempt.testId, transcript);

  return NextResponse.json({ ok: true });
}

/**
 * If the speaking attempt's parent Test is ``kind=DIAGNOSE`` and has a
 * linked WeeklyDiagnose row, write the new section status onto the row's
 * ``speakingStatus`` mirror and call ``maybeMarkDiagnoseComplete`` to
 * recompute the overall ``status`` (potentially flipping it to COMPLETE
 * if all 6 sections are now terminal).
 *
 * No-op for non-diagnose tests — those have no ``weeklyDiagnose``
 * back-relation, so the lookup returns ``null`` and we skip cleanly.
 *
 * Errors are swallowed: we never want a Prisma blip during the diagnose
 * mirror to break the speaking pipeline. Worst case the gate stays
 * locked one extra request cycle until the next mirror call (e.g., from
 * the async scoring path).
 */
async function mirrorOntoDiagnose(
  testId: string,
  newSpeakingStatus: "SUBMITTED" | "GRADED" | "AUTO_SUBMITTED",
): Promise<void> {
  try {
    const test = await prisma.test.findUnique({
      where: { id: testId },
      select: {
        kind: true,
        weeklyDiagnose: { select: { id: true } },
      },
    });
    if (test?.kind !== "DIAGNOSE" || !test.weeklyDiagnose) return;
    await prisma.weeklyDiagnose.update({
      where: { id: test.weeklyDiagnose.id },
      data: { speakingStatus: newSpeakingStatus },
    });
    await maybeMarkDiagnoseComplete(test.weeklyDiagnose.id);
  } catch (err) {
    console.warn("speaking → diagnose mirror failed (ignored):", err);
  }
}

async function runScoringInBackground(
  attemptId: string,
  testId: string,
  transcript: TranscriptTurn[],
): Promise<void> {
  try {
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: { speakingStatus: "SCORING" },
    });
    const test = await prisma.test.findUnique({ where: { id: testId } });
    const level =
      (test?.speakingPersona as "KET" | "PET" | null | undefined) ?? "KET";
    const scored = await scoreSpeakingAttempt({ level, transcript });

    const totalPossible = 20; // 5 x 4 criteria
    const rawScore = Math.round(
      scored.grammarVocab +
        scored.discourseManagement +
        scored.pronunciation +
        scored.interactive,
    );
    const scaledScore = Math.round((rawScore / totalPossible) * 100);

    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        // Mirror onto AttemptStatus so legacy filters / aggregates treat
        // a scored speaking attempt as graded.
        status: "GRADED",
        speakingStatus: "SCORED",
        rubricScores: scored as unknown as Prisma.InputJsonValue,
        rawScore,
        totalPossible,
        scaledScore,
        weakPoints: scored.weakPoints as unknown as Prisma.InputJsonValue,
      },
    });
    // Diagnose mirror — flip from SUBMITTED to GRADED. The maybeMarkComplete
    // recompute is idempotent so this is safe even if the gate already
    // released (it short-circuits when status is already COMPLETE).
    await mirrorOntoDiagnose(testId, "GRADED");
  } catch (err) {
    console.error("scoring failed", err);
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        // Mirror onto AttemptStatus: scoring failure ≈ ABANDONED for
        // legacy views; rubricScores stays null and the attempt never
        // appears in graded aggregates.
        status: "ABANDONED",
        speakingStatus: "FAILED",
        speakingError: `scoring failed: ${(err as Error).message}`.slice(0, 200),
      },
    });
  }
}
