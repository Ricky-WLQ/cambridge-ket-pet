import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/SiteHeader";
import { SECTION_TITLE_ZH } from "@/components/diagnose/SectionStatusCard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import { currentWeekStart, currentWeekEnd } from "@/lib/diagnose/week";

/**
 * Teacher class diagnose-status roll-up page (T40).
 *
 * Server-rendered table showing each student's current-week WeeklyDiagnose:
 *  - 6 per-section pills (NOT_STARTED / IN_PROGRESS / SUBMITTED / etc.)
 *  - overall row status pill
 *  - overallScore (when REPORT_READY)
 *
 * Mirrors the data shape of POST /api/teacher/diagnose-status (T24) but
 * inlines the Prisma query directly — server component → DB is cleaner
 * than the page POSTing to its own API route.
 */
const STATUS_PILL: Record<string, { label: string; className: string }> = {
  NOT_GENERATED: {
    label: "未生成",
    className: "bg-neutral-100 text-neutral-600",
  },
  PENDING: {
    label: "待开始",
    className: "bg-neutral-100 text-neutral-600",
  },
  IN_PROGRESS: {
    label: "进行中",
    className: "bg-amber-100 text-amber-800",
  },
  COMPLETE: {
    label: "已完成",
    className: "bg-blue-100 text-blue-800",
  },
  REPORT_READY: {
    label: "报告就绪",
    className: "bg-green-100 text-green-800",
  },
  REPORT_FAILED: {
    label: "报告失败",
    className: "bg-red-100 text-red-700",
  },
};

const SECTION_PILL: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "—", className: "bg-neutral-100 text-neutral-500" },
  IN_PROGRESS: { label: "中", className: "bg-amber-100 text-amber-800" },
  SUBMITTED: { label: "提", className: "bg-green-100 text-green-800" },
  AUTO_SUBMITTED: { label: "自", className: "bg-blue-100 text-blue-800" },
  GRADED: { label: "评", className: "bg-green-100 text-green-800" },
};

function scoreColor(pct: number): string {
  if (pct >= 70) return "text-green-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

export default async function TeacherDiagnoseStatusPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!dbUser || (dbUser.role !== "TEACHER" && dbUser.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!cls || cls.teacherId !== userId) notFound();

  const weekStart = currentWeekStart();
  const weekEnd = currentWeekEnd();
  const memberIds = cls.members.map((m) => m.userId);

  const wds =
    memberIds.length > 0
      ? await prisma.weeklyDiagnose.findMany({
          where: { userId: { in: memberIds }, weekStart },
          select: {
            userId: true,
            testId: true,
            status: true,
            overallScore: true,
            readingStatus: true,
            listeningStatus: true,
            writingStatus: true,
            speakingStatus: true,
            vocabStatus: true,
            grammarStatus: true,
          },
        })
      : [];
  const wdByUserId = new Map(wds.map((w) => [w.userId, w] as const));

  // Roll-up stats — how many students are in each top-level state.
  const counts = {
    NOT_GENERATED: 0,
    PENDING: 0,
    IN_PROGRESS: 0,
    COMPLETE: 0,
    REPORT_READY: 0,
    REPORT_FAILED: 0,
  } as Record<string, number>;
  for (const m of cls.members) {
    const wd = wdByUserId.get(m.userId);
    const key = wd?.status ?? "NOT_GENERATED";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="px-2">
          <Link
            href={`/teacher/classes/${cls.id}`}
            className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
          >
            ← {cls.name}
          </Link>
          <h1 className="mt-1 text-lg font-extrabold leading-tight">
            本周诊断状态
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            {weekStart.toISOString().slice(0, 10)} 至{" "}
            {weekEnd.toISOString().slice(0, 10)} · 共 {cls.members.length}{" "}
            位学生
          </p>
        </div>

        {/* Top-level roll-up. */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              "NOT_GENERATED",
              "PENDING",
              "IN_PROGRESS",
              "COMPLETE",
              "REPORT_READY",
              "REPORT_FAILED",
            ] as const
          ).map((key) => {
            const pill = STATUS_PILL[key];
            return (
              <div
                key={key}
                className="rounded-md border border-neutral-200 p-3 text-center"
              >
                <div className="text-2xl font-semibold">{counts[key] ?? 0}</div>
                <div
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
                >
                  {pill.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section legend — explains what each per-section pill means. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>说明：</span>
          {(
            [
              "NOT_STARTED",
              "IN_PROGRESS",
              "SUBMITTED",
              "AUTO_SUBMITTED",
              "GRADED",
            ] as const
          ).map((s) => {
            const pill = SECTION_PILL[s];
            const labels: Record<string, string> = {
              NOT_STARTED: "未开始",
              IN_PROGRESS: "进行中",
              SUBMITTED: "已提交",
              AUTO_SUBMITTED: "自动提交",
              GRADED: "已评分",
            };
            return (
              <span
                key={s}
                className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-0.5"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${pill.className}`}
                >
                  {pill.label}
                </span>
                {labels[s]}
              </span>
            );
          })}
        </div>

        {/* Student list. */}
        {cls.members.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            班级还没有学生。
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">学生</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  {DIAGNOSE_SECTION_KINDS.map((k: DiagnoseSectionKind) => (
                    <th
                      key={k}
                      className="px-2 py-3 text-center font-medium"
                      title={SECTION_TITLE_ZH[k]}
                    >
                      {SECTION_TITLE_ZH[k]}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium">综合得分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {cls.members.map((m) => {
                  const wd = wdByUserId.get(m.userId);
                  const status = wd?.status ?? "NOT_GENERATED";
                  const statusPill = STATUS_PILL[status] ?? STATUS_PILL.PENDING;
                  return (
                    <tr key={m.userId}>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {m.user.name ?? m.user.email}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {m.user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusPill.className}`}
                        >
                          {statusPill.label}
                        </span>
                      </td>
                      {DIAGNOSE_SECTION_KINDS.map((k: DiagnoseSectionKind) => {
                        const sectionStatus = wd
                          ? sectionStatusFor(wd, k)
                          : "NOT_STARTED";
                        const sp =
                          SECTION_PILL[sectionStatus] ?? SECTION_PILL.NOT_STARTED;
                        return (
                          <td key={k} className="px-2 py-3 text-center">
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${sp.className}`}
                              title={sectionStatus}
                            >
                              {sp.label}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        {wd?.overallScore !== null &&
                        wd?.overallScore !== undefined ? (
                          <Link
                            href={`/diagnose/report/${wd.testId}`}
                            className={`font-mono font-semibold hover:underline ${scoreColor(wd.overallScore)}`}
                          >
                            {wd.overallScore}%
                          </Link>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function sectionStatusFor(
  wd: {
    readingStatus: string;
    listeningStatus: string;
    writingStatus: string;
    speakingStatus: string;
    vocabStatus: string;
    grammarStatus: string;
  },
  kind: DiagnoseSectionKind,
): string {
  switch (kind) {
    case "READING":
      return wd.readingStatus;
    case "LISTENING":
      return wd.listeningStatus;
    case "WRITING":
      return wd.writingStatus;
    case "SPEAKING":
      return wd.speakingStatus;
    case "VOCAB":
      return wd.vocabStatus;
    case "GRAMMAR":
      return wd.grammarStatus;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return "NOT_STARTED";
    }
  }
}
