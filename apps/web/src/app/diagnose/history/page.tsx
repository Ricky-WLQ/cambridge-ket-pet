import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { Mascot } from "@/components/Mascot";
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
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="flex items-center gap-3 px-2">
          <Mascot pose="thinking" portal="ket" width={56} height={56} decorative />
          <div className="flex-1">
            <h1 className="text-base font-extrabold leading-tight">
              诊断历史
            </h1>
            <p className="mt-0.5 text-xs font-medium text-ink/60">
              最近 12 周的诊断记录
            </p>
          </div>
          <Link
            href="/diagnose"
            className="rounded-full bg-white border-2 border-ink/15 px-3 py-1.5 text-sm font-bold hover:border-ink whitespace-nowrap"
          >
            ← 本周诊断
          </Link>
        </div>

        <HistoryList items={items} />
      </main>
    </div>
  );
}
