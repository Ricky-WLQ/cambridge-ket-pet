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
import { t } from "@/i18n/zh-CN";
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
          <div
            className="rounded-3xl border-2 border-ink/10 p-6 sm:p-7 stitched-card relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)",
            }}
          >
            <h1 className="flex items-center gap-2.5 text-2xl sm:text-3xl font-extrabold">
              <span
                className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white text-[11px] font-extrabold tracking-wider"
                aria-hidden
              >
                AI
              </span>
              <span className="marker-yellow">本周诊断（教师视图）</span>
            </h1>
            <p className="mt-3 text-sm font-medium text-ink/75 leading-relaxed">
              教师与管理员不参与本周诊断。请进入「我的班级」查看每位学生的本周诊断进度。
            </p>
            <div className="mt-4">
              <Link
                href="/teacher/classes"
                className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-extrabold text-white transition hover:bg-ink/90"
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
            <div
              className="mb-6 rounded-3xl border-2 border-ink/10 p-6 sm:p-7 stitched-card relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)",
              }}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white text-[11px] font-extrabold tracking-wider"
                  aria-hidden
                >
                  AI
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold">
                  <span className="marker-yellow">{t.diagnose.pageTitle}</span>
                </h1>
              </div>
              <p className="text-sm font-medium text-ink/70 leading-relaxed">
                {t.diagnose.pageSubtitle}
              </p>
              <p className="mt-1 text-xs font-bold text-ink/60">
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
                className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
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
