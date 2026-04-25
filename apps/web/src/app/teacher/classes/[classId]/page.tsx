import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassAssignments } from "@/lib/assignments";
import { deleteAssignmentAction } from "@/lib/assignmentActions";
import ActivityFilter from "./ActivityFilter";

const KIND_ZH: Record<string, string> = {
  READING: "阅读",
  WRITING: "写作",
  LISTENING: "听力",
  SPEAKING: "口语",
  MOCK_FULL: "全套模拟",
  MOCK_SECTION: "单项模拟",
};

const STATUS_META: Record<
  "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "ABANDONED",
  { label: string; className: string }
> = {
  IN_PROGRESS: { label: "进行中", className: "bg-amber-100 text-amber-800" },
  SUBMITTED: { label: "已提交", className: "bg-blue-100 text-blue-800" },
  GRADED: { label: "已批改", className: "bg-green-100 text-green-800" },
  ABANDONED: { label: "已放弃", className: "bg-neutral-100 text-neutral-600" },
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 text-center">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function ClassOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ student?: string; status?: string }>;
}) {
  const { classId } = await params;
  const sp = await searchParams;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!cls || cls.teacherId !== userId) notFound();

  const memberIds = cls.members.map((m) => m.userId);

  const STATUS_VALUES = [
    "IN_PROGRESS",
    "SUBMITTED",
    "GRADED",
    "ABANDONED",
  ] as const;
  const statusFilter = (STATUS_VALUES as readonly string[]).includes(
    sp.status ?? "",
  )
    ? (sp.status as (typeof STATUS_VALUES)[number])
    : null;
  const studentFilter =
    sp.student && memberIds.includes(sp.student) ? sp.student : null;

  const recentWhere: Prisma.TestAttemptWhereInput = {
    userId: studentFilter
      ? studentFilter
      : memberIds.length > 0
        ? { in: memberIds }
        : undefined,
  };
  if (statusFilter) {
    recentWhere.status = statusFilter;
  }

  const assignments = await getClassAssignments(classId);

  const [
    recentAttempts,
    classAggregate,
    perStudent,
    perStudentListening,
    perStudentSpeaking,
  ] = await Promise.all([
    memberIds.length > 0
      ? prisma.testAttempt.findMany({
          where: recentWhere,
          include: {
            test: {
              select: { examType: true, kind: true, part: true },
            },
            user: { select: { id: true, email: true, name: true } },
          },
          orderBy: { startedAt: "desc" },
          take: 15,
        })
      : Promise.resolve([]),
    memberIds.length > 0
      ? prisma.testAttempt.aggregate({
          where: { userId: { in: memberIds }, status: "GRADED" },
          _count: true,
          _avg: { scaledScore: true },
          _max: { scaledScore: true },
        })
      : Promise.resolve({
          _count: 0,
          _avg: { scaledScore: null as number | null },
          _max: { scaledScore: null as number | null },
        }),
    memberIds.length > 0
      ? prisma.testAttempt.groupBy({
          by: ["userId"],
          where: { userId: { in: memberIds }, status: "GRADED" },
          _count: true,
          _avg: { scaledScore: true },
          _max: { scaledScore: true },
        })
      : Promise.resolve(
          [] as Array<{
            userId: string;
            _count: number;
            _avg: { scaledScore: number | null };
            _max: { scaledScore: number | null };
          }>,
        ),
    // Listening-only per-student stats (kind: "LISTENING")
    memberIds.length > 0
      ? prisma.testAttempt.groupBy({
          by: ["userId"],
          where: {
            userId: { in: memberIds },
            status: "GRADED",
            test: { is: { kind: "LISTENING" } },
          },
          _count: true,
          _avg: { scaledScore: true },
        })
      : Promise.resolve(
          [] as Array<{
            userId: string;
            _count: number;
            _avg: { scaledScore: number | null };
          }>,
        ),
    // Speaking-only per-student stats (kind: "SPEAKING") — mirrors the
    // listening summary so each student row shows a 口语 line at a glance.
    memberIds.length > 0
      ? prisma.testAttempt.groupBy({
          by: ["userId"],
          where: {
            userId: { in: memberIds },
            status: "GRADED",
            test: { is: { kind: "SPEAKING" } },
          },
          _count: true,
          _avg: { scaledScore: true },
        })
      : Promise.resolve(
          [] as Array<{
            userId: string;
            _count: number;
            _avg: { scaledScore: number | null };
          }>,
        ),
  ]);

  const perStudentMap = new Map(perStudent.map((s) => [s.userId, s]));
  const perStudentListeningMap = new Map(
    perStudentListening.map((s) => [s.userId, s]),
  );
  const perStudentSpeakingMap = new Map(
    perStudentSpeaking.map((s) => [s.userId, s]),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Back link + class header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/teacher/classes"
              className="text-sm text-neutral-500 hover:text-neutral-700"
            >
              ← 我的班级
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              {cls.name}
              {cls.examFocus && (
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 align-middle text-xs text-neutral-600">
                  {cls.examFocus}
                </span>
              )}
            </h1>
            <p className="text-sm text-neutral-500">
              创建于 {cls.createdAt.toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div className="rounded-md border border-neutral-300 p-3 text-right">
            <div className="text-xs text-neutral-500">邀请码</div>
            <div className="font-mono text-lg font-semibold tracking-wider">
              {cls.inviteCode}
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              分享给学生即可加入
            </div>
          </div>
        </div>

        {/* Class-wide stats */}
        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <StatCard label="学生人数" value={cls.members.length} />
          <StatCard label="已批改答卷" value={classAggregate._count} />
          <StatCard
            label="班级平均分"
            value={
              classAggregate._avg.scaledScore !== null
                ? `${Math.round(classAggregate._avg.scaledScore)}%`
                : "—"
            }
          />
          <StatCard
            label="最高分"
            value={
              classAggregate._max.scaledScore !== null
                ? `${classAggregate._max.scaledScore}%`
                : "—"
            }
          />
        </div>

        {/* Assignments */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">作业</h2>
          <Link
            href={`/teacher/classes/${cls.id}/assignments/new`}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
          >
            + 布置新作业
          </Link>
        </div>
        {assignments.length === 0 ? (
          <div className="mb-8 rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500">
            暂无作业。点击右上方「布置新作业」开始。
          </div>
        ) : (
          <ul className="mb-8 space-y-2">
            {assignments.map((a) => {
              const completionPct =
                a.totalStudents === 0
                  ? 0
                  : Math.round((a.completedStudents / a.totalStudents) * 100);
              const overdue =
                a.dueAt !== null && a.dueAt < new Date() && completionPct < 100;
              const kindZh = KIND_ZH[a.kind] ?? a.kind;
              return (
                <li
                  key={a.id}
                  className="rounded-md border border-neutral-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.title}</span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                          {a.examType} {kindZh}
                          {a.part != null && ` Part ${a.part}`}
                        </span>
                        {a.minScore != null && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                            ≥ {a.minScore}%
                          </span>
                        )}
                        {a.dueAt && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              overdue
                                ? "bg-red-100 text-red-800"
                                : "bg-neutral-100 text-neutral-600"
                            }`}
                          >
                            截止 {a.dueAt.toLocaleDateString("zh-CN")}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <form action={deleteAssignmentAction}>
                      <input
                        type="hidden"
                        name="assignmentId"
                        value={a.id}
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-red-50 hover:text-red-700"
                      >
                        删除
                      </button>
                    </form>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-neutral-600">
                      <span>
                        完成 {a.completedStudents} / {a.totalStudents} 人
                      </span>
                      <span className="font-medium">{completionPct}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full ${
                          completionPct >= 80
                            ? "bg-green-500"
                            : completionPct >= 40
                              ? "bg-amber-500"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Student list */}
        <h2 className="mb-3 text-lg font-semibold">学生名单</h2>
        {cls.members.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            暂无学生。分享邀请码{" "}
            <span className="font-mono font-semibold">{cls.inviteCode}</span>{" "}
            让学生加入。
          </div>
        ) : (
          <ul className="mb-8 space-y-2">
            {cls.members.map((m) => {
              const stats = perStudentMap.get(m.userId);
              const listeningStats = perStudentListeningMap.get(m.userId);
              const speakingStats = perStudentSpeakingMap.get(m.userId);
              const avg =
                stats?._avg.scaledScore !== null &&
                stats?._avg.scaledScore !== undefined
                  ? Math.round(stats._avg.scaledScore)
                  : null;
              const listeningAvg =
                listeningStats?._avg.scaledScore !== null &&
                listeningStats?._avg.scaledScore !== undefined
                  ? Math.round(listeningStats._avg.scaledScore)
                  : null;
              const speakingAvg =
                speakingStats?._avg.scaledScore !== null &&
                speakingStats?._avg.scaledScore !== undefined
                  ? Math.round(speakingStats._avg.scaledScore)
                  : null;
              return (
                <li
                  key={m.userId}
                  className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {m.user.name ?? m.user.email}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {m.user.email} · 加入于{" "}
                      {m.joinedAt.toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {stats ? (
                      <>
                        <div className="text-right">
                          <div>
                            <span className="text-neutral-500">已批改 </span>
                            <span className="font-semibold">
                              {stats._count}
                            </span>
                            <span className="text-neutral-500"> 份</span>
                          </div>
                          <div className="text-xs text-neutral-500">
                            平均 {avg}% · 最高{" "}
                            {stats._max.scaledScore ?? 0}%
                          </div>
                          <div className="mt-0.5 text-xs text-purple-700">
                            听力{" "}
                            {listeningStats ? (
                              <>
                                <span className="font-semibold">
                                  {listeningStats._count}
                                </span>
                                <span className="text-purple-600/70"> 份 · 平均 </span>
                                <span className="font-semibold">
                                  {listeningAvg !== null ? `${listeningAvg}%` : "—"}
                                </span>
                              </>
                            ) : (
                              <span className="text-purple-600/60">暂无</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-emerald-700">
                            口语{" "}
                            {speakingStats ? (
                              <>
                                <span className="font-semibold">
                                  {speakingStats._count}
                                </span>
                                <span className="text-emerald-600/70">
                                  {" "}
                                  份 · 平均{" "}
                                </span>
                                <span className="font-semibold">
                                  {speakingAvg !== null ? `${speakingAvg}%` : "—"}
                                </span>
                              </>
                            ) : (
                              <span className="text-emerald-600/60">暂无</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-neutral-400">
                        还没有完成任何答卷
                      </span>
                    )}
                    <Link
                      href={`/teacher/classes/${cls.id}/students/${m.userId}`}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
                    >
                      详情 →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Recent activity feed */}
        <h2 className="mb-3 text-lg font-semibold">最近活动</h2>

        {cls.members.length > 0 && (
          <ActivityFilter
            classId={cls.id}
            members={cls.members.map((m) => ({
              userId: m.userId,
              name: m.user.name ?? m.user.email,
            }))}
          />
        )}

        {recentAttempts.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            {cls.members.length === 0
              ? "班级还没有学生，暂无活动。"
              : statusFilter || studentFilter
                ? "当前筛选下没有活动。"
                : "学生还没有提交任何答卷。"}
          </div>
        ) : (
          <ul className="space-y-2">
            {recentAttempts.map((a) => {
              const statusMeta = STATUS_META[a.status];
              const kindZh = KIND_ZH[a.test.kind] ?? a.test.kind;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">
                        {a.user.name ?? a.user.email}
                      </span>
                      <span className="text-neutral-400"> · </span>
                      <span>
                        {a.test.examType} {kindZh}
                        {a.test.part != null && ` Part ${a.test.part}`}
                      </span>
                      {a.status === "GRADED" &&
                        a.scaledScore !== null && (
                          <span className="ml-2 font-mono text-neutral-700">
                            {a.scaledScore}%
                          </span>
                        )}
                    </div>
                    <div className="text-xs text-neutral-400">
                      {formatDateTime(a.startedAt)}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
