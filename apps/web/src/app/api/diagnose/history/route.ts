import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

/**
 * GET /api/diagnose/history
 *
 * Returns up to the 12 most-recent past WeeklyDiagnose rows for the logged-in
 * user, ordered by weekStart desc. Used by the diagnose history list
 * (T36-T40 frontend).
 *
 * The selected fields are the minimum needed to render a history card —
 * full knowledgePoints/summary detail is fetched on demand by the report
 * route (T22) when the user clicks into a row.
 *
 * Limit of 12 is plenty for v1: a typical KET/PET prep cycle is 8-12 weeks
 * and showing more than three months of history adds little value.
 */
export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rows = await prisma.weeklyDiagnose.findMany({
    where: { userId },
    orderBy: { weekStart: "desc" },
    take: 12,
    select: {
      id: true,
      testId: true,
      weekStart: true,
      weekEnd: true,
      status: true,
      examType: true,
      overallScore: true,
      perSectionScores: true,
    },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      ...r,
      weekStart: r.weekStart.toISOString().slice(0, 10),
      weekEnd: r.weekEnd.toISOString().slice(0, 10),
    })),
  });
}
