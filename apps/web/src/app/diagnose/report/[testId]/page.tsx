import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import DiagnoseReport from "@/components/diagnose/DiagnoseReport";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  DiagnoseSummary,
  KnowledgePointGroup,
  PerSectionScores,
} from "@/lib/diagnose/types";

/**
 * Diagnose report viewer (T38).
 *
 * Routes: /diagnose/report/[testId].
 *
 * Ownership: the WeeklyDiagnose owner (the student) can always view. A
 * teacher / admin can view iff they teach a class containing the student.
 * Anyone else gets a 404 (we don't 403 to avoid leaking the existence
 * of someone else's testId).
 *
 * The page reuses the `<DiagnoseReport>` client component used for the
 * regular per-week report; this page is just a thin server wrapper for
 * auth + Prisma load + ownership check.
 */
export default async function DiagnoseReportPage({
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
    include: {
      user: { select: { id: true, name: true } },
    },
  });
  if (!wd) notFound();

  // Ownership check.
  const isOwner = wd.userId === userId;
  let isAuthorisedTeacher = false;
  if (!isOwner) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (dbUser?.role === "TEACHER" || dbUser?.role === "ADMIN") {
      const member = await prisma.classMember.findFirst({
        where: {
          userId: wd.userId,
          class: { teacherId: userId },
        },
        select: { userId: true },
      });
      isAuthorisedTeacher = !!member;
    }
  }
  if (!isOwner && !isAuthorisedTeacher) notFound();

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
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="px-2">
          <Link
            href="/diagnose"
            className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
          >
            ← 返回本周诊断
          </Link>
        </div>
        <DiagnoseReport report={report} showStudentName={!isOwner} />
      </main>
    </div>
  );
}
