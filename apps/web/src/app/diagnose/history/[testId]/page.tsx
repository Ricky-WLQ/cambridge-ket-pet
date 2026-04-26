import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import DiagnoseReport from "@/components/diagnose/DiagnoseReport";
import { SECTION_TITLE_ZH } from "@/components/diagnose/SectionStatusCard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import type {
  DiagnoseSummary,
  KnowledgePointGroup,
  PerSectionScores,
} from "@/lib/diagnose/types";

/**
 * Per-week diagnose history detail page (T39b).
 *
 * Reuses `<DiagnoseReport>` for the report body. Adds a per-section
 * "重做练习（不计分）" CTA that routes to /diagnose/replay/[testId]/[section].
 *
 * Owner-only — teachers should hit /teacher/classes/[id]/students/[id]/...
 * to view a student's report (different access path with team controls).
 * If we wanted to allow teacher access here we'd duplicate the ownership
 * branch from /diagnose/report/[testId]; for v1 we keep the history page
 * student-only since teachers don't have "history" in their UX flow.
 */
export default async function DiagnoseHistoryDetailPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { testId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!wd || wd.userId !== userId) notFound();

  const report = {
    weeklyDiagnoseId: wd.id,
    testId: wd.testId,
    examType: wd.examType,
    weekStart: wd.weekStart.toISOString().slice(0, 10),
    weekEnd: wd.weekEnd.toISOString().slice(0, 10),
    status: wd.status,
    knowledgePoints: wd.knowledgePoints as KnowledgePointGroup[] | null,
    summary: wd.summary as DiagnoseSummary | null,
    perSectionScores: wd.perSectionScores as PerSectionScores | null,
    overallScore: wd.overallScore,
    reportError: wd.reportError,
    student: wd.user,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/diagnose/history"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ← 返回历史列表
          </Link>
          <Link
            href="/diagnose"
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            本周诊断 →
          </Link>
        </div>

        <DiagnoseReport report={report} />

        <section className="mt-8 rounded-md border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            重做练习（不计分）
          </h2>
          <p className="mb-4 text-xs text-neutral-500">
            重做仅作复习用途，不会更新本周诊断状态，也不计入历史评分。
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {DIAGNOSE_SECTION_KINDS.map((kind: DiagnoseSectionKind) => (
              <Link
                key={kind}
                href={`/diagnose/replay/${testId}/${kind.toLowerCase()}`}
                className="rounded-md border border-neutral-300 bg-white p-3 text-center text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50"
              >
                {SECTION_TITLE_ZH[kind]}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
