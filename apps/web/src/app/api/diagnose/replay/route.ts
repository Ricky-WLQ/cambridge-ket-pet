import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

export const maxDuration = 30;

/**
 * POST /api/diagnose/replay
 *
 * Body: `{ testId }` — id of a past DIAGNOSE Test row owned by the caller.
 *
 * Creates 6 NEW TestAttempt rows in PRACTICE mode (one per diagnose section)
 * pointing at the same Test row, so the user can re-take the past diagnose
 * for self-study. These attempts are deliberately invisible to the diagnose
 * gate — they don't update WeeklyDiagnose.{section}AttemptId or its status
 * mirror, so the gate still keys off the original attempt set.
 *
 * Behavior:
 *  - 401 if not signed in.
 *  - 400 if body fails Zod.
 *  - 404 if no WeeklyDiagnose has the requested testId.
 *  - 403 if the caller does not own the WeeklyDiagnose.
 *  - 201 with `{ attempts: [{ id, sectionKind }, ...] }` on success.
 *
 * The `answers` JSON gets a `{ sectionKind, replay: true }` discriminator
 * so the runner UI knows to render in replay mode (no time limit, no gate
 * mirror update on submit).
 */
export async function POST(req: Request) {
  const portal = derivePortalFromRequest(req);
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }
  const parsed = z.object({ testId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  // Verify the testId points to a real WeeklyDiagnose owned by the caller.
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { testId: parsed.data.testId },
    select: { userId: true, testId: true },
  });
  if (!wd) {
    return NextResponse.json({ error: "诊断不存在" }, { status: 404 });
  }
  if (wd.userId !== userId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  // Create 6 new TestAttempt rows in a single transaction so all-or-nothing.
  // Each row carries `{ sectionKind, replay: true }` in answers so the runner
  // can detect replay mode and skip gate-side-effects on submit.
  const sectionKinds: readonly DiagnoseSectionKind[] = DIAGNOSE_SECTION_KINDS;
  const startedAt = new Date();
  const attempts = await prisma.$transaction(
    sectionKinds.map((sectionKind) =>
      prisma.testAttempt.create({
        data: {
          userId,
          testId: wd.testId,
          mode: "PRACTICE",
          status: "IN_PROGRESS",
          startedAt,
          answers: { sectionKind, replay: true } as Prisma.InputJsonValue,
        },
        select: { id: true, answers: true },
      }),
    ),
  );

  return NextResponse.json(
    {
      attempts: attempts.map((a) => {
        const ans = a.answers as { sectionKind?: string } | null;
        return { id: a.id, sectionKind: ans?.sectionKind ?? null };
      }),
    },
    { status: 201 },
  );
}
