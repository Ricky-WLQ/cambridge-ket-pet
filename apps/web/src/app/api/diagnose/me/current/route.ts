import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeekStart, currentWeekEnd } from "@/lib/diagnose/week";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

export const maxDuration = 30;

/**
 * GET /api/diagnose/me/current
 *
 * Returns the current ISO-week (CST) WeeklyDiagnose state for the logged-in
 * student. Used by the `/diagnose` hub page to render the 6-section status
 * grid.
 *
 * Behavior:
 *  - 401 if no session.
 *  - If no WeeklyDiagnose row exists for the current week, returns
 *    `status: "NEED_GENERATE"` with a null `diagnoseId`/`testId`/`examType`
 *    and `sections: null`. Caller routes the user into the generate flow.
 *  - Otherwise echoes the WeeklyDiagnose status, ids, examType, the parent
 *    Test row's `audioStatus`, and per-section `{ status, attemptId }`.
 *
 * Read-only — no DB writes.
 */
export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const portal = derivePortalFromRequest(req);
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  const weekStart = currentWeekStart();
  const weekEnd = currentWeekEnd();

  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: {
      test: { select: { id: true, audioStatus: true } },
    },
  });

  if (!wd) {
    return NextResponse.json({
      weekStart: weekStart.toISOString().slice(0, 10),
      weekEnd: weekEnd.toISOString().slice(0, 10),
      status: "NEED_GENERATE",
      diagnoseId: null,
      testId: null,
      examType: null,
      audioStatus: null,
      sections: null,
    });
  }

  return NextResponse.json({
    weekStart: wd.weekStart.toISOString().slice(0, 10),
    weekEnd: wd.weekEnd.toISOString().slice(0, 10),
    status: wd.status,
    diagnoseId: wd.id,
    testId: wd.testId,
    examType: wd.examType,
    audioStatus: wd.test?.audioStatus ?? null,
    sections: {
      READING: { status: wd.readingStatus, attemptId: wd.readingAttemptId },
      LISTENING: {
        status: wd.listeningStatus,
        attemptId: wd.listeningAttemptId,
      },
      WRITING: { status: wd.writingStatus, attemptId: wd.writingAttemptId },
      SPEAKING: { status: wd.speakingStatus, attemptId: wd.speakingAttemptId },
      VOCAB: { status: wd.vocabStatus, attemptId: wd.vocabAttemptId },
      GRAMMAR: { status: wd.grammarStatus, attemptId: wd.grammarAttemptId },
    },
  });
}
