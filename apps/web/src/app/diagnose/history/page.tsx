import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import HistoryList from "@/components/diagnose/HistoryList";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Diagnose history page (T39a).
 *
 * Lists the last 12 WeeklyDiagnose rows for the user, ordered by weekStart desc.
 * Each row links into the per-week read-only report at /diagnose/history/[testId].
 */
export default async function DiagnoseHistoryPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

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
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    testId: r.testId,
    weekStart: r.weekStart.toISOString().slice(0, 10),
    weekEnd: r.weekEnd.toISOString().slice(0, 10),
    status: r.status as
      | "PENDING"
      | "IN_PROGRESS"
      | "COMPLETE"
      | "REPORT_READY"
      | "REPORT_FAILED",
    examType: r.examType,
    overallScore: r.overallScore,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">诊断历史</h1>
          <Link
            href="/diagnose"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ← 返回本周诊断
          </Link>
        </div>
        <p className="mb-6 text-sm text-neutral-500">
          最近 12 周的诊断记录，按周倒序排列。
        </p>

        <HistoryList items={items} />
      </main>
    </div>
  );
}
