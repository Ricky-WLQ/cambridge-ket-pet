import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/diagnose/week";
import {
  DIAGNOSE_SECTION_KINDS,
  deadlineFor,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

export const maxDuration = 60;

interface RouteCtx {
  params: Promise<{ sectionKind: string }>;
}

/**
 * POST /api/diagnose/me/section/[sectionKind]/start
 *
 * Per-section runner entrypoint (T19). Idempotent — if a TestAttempt already
 * exists for the named section under the current-week WeeklyDiagnose, returns
 * the existing attemptId rather than creating a duplicate row.
 *
 * Behavior:
 *  1. Auth → 401 if missing.
 *  2. Validate `sectionKind` is one of the 6 diagnose sections.
 *  3. Look up the user's current-week WeeklyDiagnose.
 *      - 404 if absent (caller must hit /generate first).
 *  4. Verify the parent Test row is `kind === DIAGNOSE` (defensive guard;
 *     would only fail if something else mutated WeeklyDiagnose.testId).
 *  5. If WeeklyDiagnose.{section}AttemptId is already set, verify the row
 *     exists and return its id + startedAt + deadlineAt unchanged.
 *  6. Otherwise create a new TestAttempt:
 *      - status: "IN_PROGRESS"
 *      - mode: "MOCK"
 *      - answers: { sectionKind } as a discriminator stub
 *      - speakingStatus: "IDLE" for SPEAKING (existing speaking flow expects
 *        this so the session-start route can transition IDLE → IN_PROGRESS).
 *  7. Update WeeklyDiagnose: set the section's attemptId FK + status mirror
 *     to IN_PROGRESS. Also bump WeeklyDiagnose.status from PENDING → IN_PROGRESS
 *     on the first section start.
 *  8. Return `{ attemptId, startedAt, deadlineAt }`.
 *
 * Why we hard-code 6 update branches instead of dynamic [field] keys:
 *  Prisma's generated `update` types disallow string-keyed bracket access
 *  for typed fields. A `Record<string, …>` cast would lose type safety on
 *  every field name — and there are only 6, so an explicit switch is both
 *  cleaner and TS-friendly.
 *
 * Speaking note:
 *  This route just creates the bare TestAttempt row with speakingStatus=IDLE.
 *  The actual Akool session is started by /api/speaking/[attemptId]/session-
 *  start, which the SpeakingRunner component calls when the user clicks
 *  "Start". This split mirrors the practice flow.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  // ──── Step 1: Auth ────────────────────────────────────────────────
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const portal = derivePortalFromRequest(req);
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  // ──── Step 2: Validate sectionKind ───────────────────────────────
  const { sectionKind: rawKind } = await ctx.params;
  if (
    !(DIAGNOSE_SECTION_KINDS as readonly string[]).includes(rawKind)
  ) {
    return NextResponse.json(
      { error: "Invalid sectionKind" },
      { status: 400 },
    );
  }
  const sectionKind = rawKind as DiagnoseSectionKind;

  // ──── Step 3: Find current-week WeeklyDiagnose ───────────────────
  const weekStart = currentWeekStart();
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { test: { select: { id: true, kind: true } } },
  });
  if (!wd) {
    return NextResponse.json(
      { error: "本周诊断尚未生成，请先调用 /generate" },
      { status: 404 },
    );
  }

  // ──── Step 4: Defensive Test.kind guard ──────────────────────────
  if (wd.test?.kind !== "DIAGNOSE") {
    return NextResponse.json(
      { error: "Linked Test is not a DIAGNOSE row" },
      { status: 500 },
    );
  }

  // ──── Step 5: Idempotency — return existing attempt if present ──
  const existingAttemptId = pickAttemptId(wd, sectionKind);
  if (existingAttemptId) {
    const existing = await prisma.testAttempt.findUnique({
      where: { id: existingAttemptId },
      select: { id: true, startedAt: true },
    });
    if (existing) {
      return NextResponse.json({
        attemptId: existing.id,
        startedAt: existing.startedAt.toISOString(),
        deadlineAt: deadlineFor(sectionKind, existing.startedAt).toISOString(),
      });
    }
    // Edge case: WeeklyDiagnose.{section}AttemptId points to a deleted row.
    // Fall through to create a fresh one (the FK on WeeklyDiagnose has no
    // onDelete cascade, so this can happen if someone manually deletes a
    // TestAttempt). The update below will overwrite the stale FK.
  }

  // ──── Step 6: Create new TestAttempt ─────────────────────────────
  const answersStub: Prisma.InputJsonValue = { sectionKind };
  const attempt = await prisma.testAttempt.create({
    data: {
      userId,
      testId: wd.testId,
      mode: "MOCK",
      status: "IN_PROGRESS",
      startedAt: new Date(),
      answers: answersStub,
      // For SPEAKING the existing /api/speaking/[attemptId]/session-start
      // route requires speakingStatus to be IDLE before it will create an
      // Akool session.
      ...(sectionKind === "SPEAKING" ? { speakingStatus: "IDLE" } : {}),
    },
    select: { id: true, startedAt: true },
  });

  // ──── Step 7: Update WeeklyDiagnose section FK + status mirror ──
  // Six explicit branches — see module-docstring rationale.
  await updateSectionFk(wd.id, sectionKind, attempt.id);

  // ──── Step 8: Return ─────────────────────────────────────────────
  return NextResponse.json(
    {
      attemptId: attempt.id,
      startedAt: attempt.startedAt.toISOString(),
      deadlineAt: deadlineFor(sectionKind, attempt.startedAt).toISOString(),
    },
    { status: 201 },
  );
}

/** Read the existing per-section attemptId off a WeeklyDiagnose row. */
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
 * Update the WeeklyDiagnose row to record this section's attemptId + flip
 * its status mirror to IN_PROGRESS. Also bumps the overall row status from
 * PENDING → IN_PROGRESS (no-op if already past PENDING).
 *
 * Six explicit branches keeps Prisma's update types happy; a dynamic
 * `{ [field]: value }` shape would lose typing.
 */
async function updateSectionFk(
  wdId: string,
  sectionKind: DiagnoseSectionKind,
  attemptId: string,
): Promise<void> {
  const overall = { status: "IN_PROGRESS" as const };
  switch (sectionKind) {
    case "READING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          readingAttemptId: attemptId,
          readingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "LISTENING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          listeningAttemptId: attemptId,
          listeningStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "WRITING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          writingAttemptId: attemptId,
          writingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "SPEAKING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          speakingAttemptId: attemptId,
          speakingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "VOCAB":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          vocabAttemptId: attemptId,
          vocabStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "GRAMMAR":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          grammarAttemptId: attemptId,
          grammarStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    default: {
      const _exhaustive: never = sectionKind;
      void _exhaustive;
    }
  }
}
