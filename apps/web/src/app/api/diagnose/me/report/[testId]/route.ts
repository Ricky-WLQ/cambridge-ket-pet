import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

export const maxDuration = 30;

interface RouteCtx {
  params: Promise<{ testId: string }>;
}

/**
 * GET /api/diagnose/me/report/[testId]
 *
 * Returns the report (knowledgePoints + summary + perSectionScores +
 * overallScore + status + reportError + week range) for a specific past
 * WeeklyDiagnose, keyed by the parent Test row's id.
 *
 * Ownership:
 *  - The owning student (caller's userId === wd.userId) can read freely.
 *  - A TEACHER or ADMIN can read iff they teach a class containing the
 *    student. We check ClassMember (class.teacherId === userId AND
 *    classMember.userId === wd.userId).
 *
 * Why testId in the URL (not weeklyDiagnoseId):
 *  - The history list (T23a) hands back testId as the canonical handle for
 *    a past diagnose, since multiple downstream features (replay, teacher
 *    drill-in) operate on the Test row. WeeklyDiagnose.testId is unique so
 *    this is a stable 1:1 mapping.
 */
export async function GET(req: Request, ctx: RouteCtx) {
  const { testId } = await ctx.params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const portal = derivePortalFromRequest(req);
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { testId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!wd) {
    return NextResponse.json(
      { error: "诊断报告不存在" },
      { status: 404 },
    );
  }

  // Ownership check.
  if (wd.userId !== userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (dbUser?.role !== "TEACHER" && dbUser?.role !== "ADMIN") {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }
    // Teacher/admin: must teach a class that contains the student.
    const classMember = await prisma.classMember.findFirst({
      where: {
        userId: wd.userId,
        class: { teacherId: userId },
      },
      select: { userId: true },
    });
    if (!classMember) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }
  }

  return NextResponse.json({
    weeklyDiagnoseId: wd.id,
    testId: wd.testId,
    examType: wd.examType,
    weekStart: wd.weekStart.toISOString().slice(0, 10),
    weekEnd: wd.weekEnd.toISOString().slice(0, 10),
    status: wd.status,
    knowledgePoints: wd.knowledgePoints,
    summary: wd.summary,
    perSectionScores: wd.perSectionScores,
    overallScore: wd.overallScore,
    reportError: wd.reportError,
    student: wd.user,
  });
}
