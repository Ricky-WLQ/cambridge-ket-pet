import Link from "next/link";
import { redirect } from "next/navigation";
import type { WeeklyDiagnose } from "@prisma/client";

import { SiteHeader } from "@/components/SiteHeader";
import DiagnoseHub, {
  type DiagnoseHubStatus,
} from "@/components/diagnose/DiagnoseHub";
import HistoryList from "@/components/diagnose/HistoryList";
import SessionRefresher from "@/components/diagnose/SessionRefresher";
import type { DiagnoseSectionStatus } from "@/components/diagnose/SectionStatusCard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findCurrentWeekDiagnose } from "@/lib/diagnose/eligibility";
import { runFinalizePipeline } from "@/lib/diagnose/finalize";
import { currentWeekStart, currentWeekEnd } from "@/lib/diagnose/week";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";

import GenerateButton from "./GenerateButton";

/**
 * Diagnose hub page (T36).
 *
 * Three render branches by user state:
 *  - TEACHER / ADMIN  → info card + link to /teacher/classes (no diagnose
 *    flow for teachers; they consume the class-status roll-up instead).
 *  - STUDENT, no row this week → <GenerateButton /> empty state.
 *  - STUDENT, row exists → <DiagnoseHub /> with 6-section grid + report
 *    link when REPORT_READY.
 *
 * Always renders the past-12-weeks history list at the bottom for STUDENT
 * (after the hub) and admins (informational).
 */
export default async function DiagnoseHubPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const role = dbUser?.role ?? "STUDENT";
  const isTeacher = role === "TEACHER" || role === "ADMIN";

  // Teachers and admins do not take the diagnose. Show an info card pointing
  // them at the class-level roll-up instead.
  if (isTeacher) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl px-6 py-10">
          <div className="rounded-md border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-6">
            <h1 className="flex items-center gap-2 text-lg font-semibold text-indigo-900">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                aria-hidden
              >
                AI
              </span>
              本周诊断（教师视图）
            </h1>
            <p className="mt-2 text-sm text-indigo-800/80">
              教师与管理员不参与本周诊断。请进入「我的班级」查看每位学生的本周诊断进度。
            </p>
            <div className="mt-4">
              <Link
                href="/teacher/classes"
                className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                查看班级诊断状态 →
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // STUDENT path — load current-week WeeklyDiagnose + last 12 weeks.
  const weekStart = currentWeekStart();
  const weekEnd = currentWeekEnd();
  let wd = await findCurrentWeekDiagnose(userId);

  // C2 (finalize trigger on hub render): when the row is in COMPLETE but
  // hasn't been finalized (reportAt === null), kick the post-submit pipeline
  // server-side. This is the canonical bridge from "all 6 sections done"
  // (gate-released) to "report visible" — the section-submit route flips
  // status to COMPLETE but doesn't trigger AI analysis itself, so without
  // this server-side trigger the user would see a stuck COMPLETE state
  // forever. The pipeline is idempotent and a re-fetch of `wd` after the
  // call surfaces the new status (REPORT_READY or REPORT_FAILED) so the
  // hub renders the report CTA on the same page load.
  //
  // Errors are swallowed here on purpose — the pipeline already persists
  // status=REPORT_FAILED with a reportError for analysis/summary failures,
  // and the hub renders a retry hint when status is REPORT_FAILED. A
  // throw at this layer would render an unhelpful 500 page.
  if (wd && wd.status === "COMPLETE" && wd.reportAt === null) {
    try {
      await runFinalizePipeline(userId);
    } catch (err) {
      console.error("[diagnose] finalize pipeline crashed on hub render:", err);
    }
    // Re-fetch so the rendered hub reflects the post-pipeline status.
    wd = await findCurrentWeekDiagnose(userId);
  }

  const history = await prisma.weeklyDiagnose.findMany({
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
  // Drop the current-week row from the history list — it's already shown
  // in the hub above.
  const pastHistory = history.filter(
    (h) => h.weekStart.getTime() !== weekStart.getTime(),
  );

  // C4 (JWT refresh on gate release): once the row reaches an ungated state
  // (COMPLETE / REPORT_READY / REPORT_FAILED), the JWT cached on the client
  // still holds the old requiredDiagnoseId value. SessionRefresher mounts a
  // tiny client-side effect that POSTs to /api/auth/session, which fires the
  // jwt callback's trigger="update" branch — that re-reads
  // getRequiredDiagnoseId() and returns null, refreshing the cache. The
  // refresh is deduped by weeklyDiagnoseId so it fires only once per row.
  const ungated =
    wd !== null &&
    (wd.status === "COMPLETE" ||
      wd.status === "REPORT_READY" ||
      wd.status === "REPORT_FAILED");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {wd !== null && (
        <SessionRefresher shouldRefresh={ungated} weeklyDiagnoseId={wd.id} />
      )}
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        {wd === null ? (
          <>
            {/* Empty-state: student has not generated this week's diagnose. */}
            <div className="mb-6 rounded-md border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-5">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-indigo-900">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                  aria-hidden
                >
                  AI
                </span>
                本周诊断
              </h1>
              <p className="mt-0.5 text-xs text-indigo-700/80">
                AI 一键综合分析你本周的练习
              </p>
              <p className="mt-1 text-xs text-indigo-700/70">
                {weekStart.toISOString().slice(0, 10)} 至{" "}
                {weekEnd.toISOString().slice(0, 10)}
              </p>
            </div>
            <GenerateButton />
          </>
        ) : (
          <DiagnoseHub
            weekStart={wd.weekStart.toISOString().slice(0, 10)}
            weekEnd={wd.weekEnd.toISOString().slice(0, 10)}
            status={wd.status as DiagnoseHubStatus}
            sections={
              DIAGNOSE_SECTION_KINDS.reduce(
                (acc, kind) => {
                  acc[kind] = sectionStateFor(wd, kind);
                  return acc;
                },
                {} as Record<
                  DiagnoseSectionKind,
                  { status: DiagnoseSectionStatus; attemptId: string | null }
                >,
              )
            }
            examType={wd.examType}
            testId={wd.testId}
          />
        )}

        {pastHistory.length > 0 && (
          <div className="mt-10">
            <HistoryList
              items={pastHistory.map((h) => ({
                id: h.id,
                testId: h.testId,
                weekStart: h.weekStart.toISOString().slice(0, 10),
                weekEnd: h.weekEnd.toISOString().slice(0, 10),
                status: h.status as
                  | "PENDING"
                  | "IN_PROGRESS"
                  | "COMPLETE"
                  | "REPORT_READY"
                  | "REPORT_FAILED",
                examType: h.examType,
                overallScore: h.overallScore,
              }))}
            />
            <div className="mt-3 text-right">
              <Link
                href="/diagnose/history"
                className="text-sm text-neutral-500 hover:text-neutral-900"
              >
                查看完整历史 →
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/** Read the per-section { status, attemptId } off a WeeklyDiagnose row. */
function sectionStateFor(
  wd: WeeklyDiagnose,
  kind: DiagnoseSectionKind,
): { status: DiagnoseSectionStatus; attemptId: string | null } {
  switch (kind) {
    case "READING":
      return {
        status: wd.readingStatus as DiagnoseSectionStatus,
        attemptId: wd.readingAttemptId,
      };
    case "LISTENING":
      return {
        status: wd.listeningStatus as DiagnoseSectionStatus,
        attemptId: wd.listeningAttemptId,
      };
    case "WRITING":
      return {
        status: wd.writingStatus as DiagnoseSectionStatus,
        attemptId: wd.writingAttemptId,
      };
    case "SPEAKING":
      return {
        status: wd.speakingStatus as DiagnoseSectionStatus,
        attemptId: wd.speakingAttemptId,
      };
    case "VOCAB":
      return {
        status: wd.vocabStatus as DiagnoseSectionStatus,
        attemptId: wd.vocabAttemptId,
      };
    case "GRAMMAR":
      return {
        status: wd.grammarStatus as DiagnoseSectionStatus,
        attemptId: wd.grammarAttemptId,
      };
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return { status: "NOT_STARTED", attemptId: null };
    }
  }
}
