import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ExamType, Prisma } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassAssignments } from "@/lib/assignments";
import { deleteAssignmentAction } from "@/lib/assignmentActions";
import { MASTERY_MASTERED_THRESHOLD } from "@/lib/vocab/srs";
import ActivityFilter from "./ActivityFilter";

interface ClassVocabRow {
  userId: string;
  userName: string;
  coreMastered: number;
  coreTotal: number;
}

interface ClassVocabSummary {
  ket: ClassVocabRow[];
  pet: ClassVocabRow[];
}

async function getClassVocabSummary(
  members: ReadonlyArray<{ userId: string; user: { id: string; email: string; name: string | null } }>,
): Promise<ClassVocabSummary> {
  const userIds = members.map((m) => m.userId);

  const buildRows = async (examType: ExamType): Promise<ClassVocabRow[]> => {
    const coreTotal = await prisma.word.count({
      where: { examType, tier: "CORE" },
    });
    const counts =
      userIds.length > 0
        ? await prisma.vocabProgress.groupBy({
            by: ["userId"],
            where: {
              userId: { in: userIds },
              examType,
              mastery: { gte: MASTERY_MASTERED_THRESHOLD },
              wordRef: { tier: "CORE" },
            },
            _count: { _all: true },
          })
        : [];
    const byUser = new Map(counts.map((c) => [c.userId, c._count._all]));
    return members.map((m) => ({
      userId: m.userId,
      userName: m.user.name ?? m.user.email ?? m.userId,
      coreMastered: byUser.get(m.userId) ?? 0,
      coreTotal,
    }));
  };

  const [ket, pet] = await Promise.all([buildRows("KET"), buildRows("PET")]);
  return { ket, pet };
}

interface ClassGrammarRow {
  userId: string;
  userName: string;
  attempted: number;
  correct: number;
  accuracy: number;
}
interface CommonWeakness {
  topicId: string;
  labelZh: string;
  classAccuracy: number;
  classAttempts: number;
}

async function getClassGrammarSummary(
  members: ReadonlyArray<{
    userId: string;
    user: { id: string; email: string; name: string | null };
  }>,
): Promise<{
  ket: { rows: ClassGrammarRow[]; weakTopics: CommonWeakness[] };
  pet: { rows: ClassGrammarRow[]; weakTopics: CommonWeakness[] };
}> {
  const userIds = members.map((m) => m.userId);

  const buildExam = async (examType: ExamType) => {
    if (userIds.length === 0) {
      return {
        rows: [] as ClassGrammarRow[],
        weakTopics: [] as CommonWeakness[],
      };
    }
    const rowsByUser = await prisma.grammarProgress.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, examType },
      _count: { _all: true },
    });
    const correctByUser = await prisma.grammarProgress.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, examType, isCorrect: true },
      _count: { _all: true },
    });
    const attemptedMap = new Map(
      rowsByUser.map((r) => [r.userId, r._count._all]),
    );
    const correctMap = new Map(
      correctByUser.map((r) => [r.userId, r._count._all]),
    );
    const rows: ClassGrammarRow[] = members.map((m) => {
      const attempted = attemptedMap.get(m.userId) ?? 0;
      const correct = correctMap.get(m.userId) ?? 0;
      const accuracy = attempted === 0 ? 0 : correct / attempted;
      return {
        userId: m.userId,
        userName: m.user.name ?? m.user.email ?? m.userId,
        attempted,
        correct,
        accuracy,
      };
    });

    // Common weakness topics — class-aggregated, accuracy < 60% with ≥ 3 class-wide attempts
    const topicAgg = await prisma.grammarProgress.groupBy({
      by: ["topicId"],
      where: { userId: { in: userIds }, examType },
      _count: { _all: true },
    });
    const topicCorrect = await prisma.grammarProgress.groupBy({
      by: ["topicId"],
      where: { userId: { in: userIds }, examType, isCorrect: true },
      _count: { _all: true },
    });
    const correctByTopic = new Map(
      topicCorrect.map((t) => [t.topicId, t._count._all]),
    );
    const topicMeta = await prisma.grammarTopic.findMany({
      where: { examType, id: { in: topicAgg.map((t) => t.topicId) } },
      select: { id: true, labelZh: true },
    });
    const labelMap = new Map(topicMeta.map((t) => [t.id, t.labelZh]));
    const weakTopics: CommonWeakness[] = topicAgg
      .map((t) => {
        const c = correctByTopic.get(t.topicId) ?? 0;
        return {
          topicId: t.topicId,
          labelZh: labelMap.get(t.topicId) ?? t.topicId,
          classAttempts: t._count._all,
          classAccuracy: t._count._all === 0 ? 0 : c / t._count._all,
        };
      })
      .filter((t) => t.classAttempts >= 3 && t.classAccuracy < 0.6)
      .sort((a, b) => a.classAccuracy - b.classAccuracy)
      .slice(0, 3);

    return { rows, weakTopics };
  };

  const [ket, pet] = await Promise.all([buildExam("KET"), buildExam("PET")]);
  return { ket, pet };
}

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
  IN_PROGRESS: {
    label: "进行中",
    className: "pill-tag bg-sky-soft border-2 border-ink/15",
  },
  SUBMITTED: {
    label: "已提交",
    className: "pill-tag bg-butter-soft border-2 border-ink/15",
  },
  GRADED: {
    label: "已批改",
    className: "pill-tag bg-mint-soft border-2 border-ink/15",
  },
  ABANDONED: {
    label: "已放弃",
    className: "pill-tag bg-peach-soft border-2 border-ink/15",
  },
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
  tile = "lavender",
}: {
  label: string;
  value: string | number;
  tile?: "lavender" | "sky" | "butter" | "peach" | "mint" | "cream";
}) {
  return (
    <div className={`stat-card tile-${tile} text-center`}>
      <div className="text-xs uppercase tracking-wider font-bold text-ink/60">
        {label}
      </div>
      <div className="mt-1 text-3xl font-extrabold">{value}</div>
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

  const vocabSummary = await getClassVocabSummary(cls.members);
  const grammarSummary = await getClassGrammarSummary(cls.members);

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        {/* Back link + class header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/teacher/classes"
              className="text-sm font-bold text-ink/60 hover:text-ink transition"
            >
              ← 我的班级
            </Link>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight">
              <span className="marker-yellow-thick">{cls.name}</span>
              {cls.examFocus && (
                <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 align-middle text-xs font-bold text-ink/65">
                  {cls.examFocus}
                </span>
              )}
            </h1>
            <p className="text-sm font-medium text-ink/60">
              创建于 {cls.createdAt.toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div className="rounded-2xl bg-white border-2 border-ink/10 p-3 text-right stitched-card">
            <div className="text-xs font-bold text-ink/60">邀请码</div>
            <div className="font-mono text-lg font-extrabold tracking-wider">
              {cls.inviteCode}
            </div>
            <div className="mt-1 text-xs font-medium text-ink/50">
              分享给学生即可加入
            </div>
          </div>
        </div>

        {/* Class-wide stats */}
        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <StatCard
            label="学生人数"
            value={cls.members.length}
            tile="lavender"
          />
          <StatCard
            label="已批改答卷"
            value={classAggregate._count}
            tile="sky"
          />
          <StatCard
            label="班级平均分"
            value={
              classAggregate._avg.scaledScore !== null
                ? `${Math.round(classAggregate._avg.scaledScore)}%`
                : "—"
            }
            tile="mint"
          />
          <StatCard
            label="最高分"
            value={
              classAggregate._max.scaledScore !== null
                ? `${classAggregate._max.scaledScore}%`
                : "—"
            }
            tile="butter"
          />
        </div>

        {/* Vocab progress (class-aggregated CORE-tier mastery) */}
        <div className="mb-8 rounded-2xl bg-white border-2 border-ink/10 p-5 stitched-card">
          <h2 className="mb-3 text-xl sm:text-2xl font-extrabold">
            <span className="marker-yellow">词汇练习概况</span>
          </h2>
          {(["ket", "pet"] as const).map((k) => {
            const rows = vocabSummary[k];
            const totalMastered = rows.reduce(
              (a, r) => a + r.coreMastered,
              0,
            );
            const totalDenom = rows.reduce((a, r) => a + r.coreTotal, 0);
            const pct =
              totalDenom === 0
                ? 0
                : Math.round((totalMastered / totalDenom) * 100);
            const sortedDesc = [...rows].sort(
              (a, b) => b.coreMastered - a.coreMastered,
            );
            const sortedAsc = [...rows].sort(
              (a, b) => a.coreMastered - b.coreMastered,
            );
            const top = sortedDesc.slice(0, 5);
            const bottom = sortedAsc.slice(0, 5);
            return (
              <div key={k} className="mb-4 last:mb-0">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold uppercase">{k}</span>
                  <span className="text-xs text-neutral-600">
                    班级平均必修掌握{" "}
                    <strong className="text-neutral-900">{pct}%</strong>
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {rows.length === 0 ? (
                  <p className="mt-3 text-xs text-neutral-400">
                    班级还没有学生。
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="mb-1 font-semibold text-green-700">
                        熟练度前 5
                      </div>
                      <ul className="space-y-0.5">
                        {top.map((r) => (
                          <li
                            key={r.userId}
                            className="flex justify-between gap-2"
                          >
                            <span className="truncate">{r.userName}</span>
                            <span className="shrink-0 font-mono text-neutral-500">
                              {r.coreMastered}/{r.coreTotal}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 font-semibold text-red-700">
                        需关注 (后 5)
                      </div>
                      <ul className="space-y-0.5">
                        {bottom.map((r) => (
                          <li
                            key={r.userId}
                            className="flex justify-between gap-2"
                          >
                            <span className="truncate">{r.userName}</span>
                            <span className="shrink-0 font-mono text-neutral-500">
                              {r.coreMastered}/{r.coreTotal}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grammar progress (class-aggregated accuracy + weak-topic spotter) */}
        <div className="mb-8 rounded-2xl bg-white border-2 border-ink/10 p-5 stitched-card">
          <h2 className="mb-3 text-xl sm:text-2xl font-extrabold">
            <span className="marker-yellow">语法练习概况</span>
          </h2>
          {(["ket", "pet"] as const).map((k) => {
            const { rows, weakTopics } = grammarSummary[k];
            const totalAttempted = rows.reduce((s, r) => s + r.attempted, 0);
            const totalCorrect = rows.reduce((s, r) => s + r.correct, 0);
            const classAcc =
              totalAttempted === 0
                ? 0
                : Math.round((totalCorrect / totalAttempted) * 100);
            const top = [...rows]
              .sort((a, b) => b.accuracy - a.accuracy)
              .slice(0, 5);
            const bottom = [...rows]
              .sort((a, b) => a.accuracy - b.accuracy)
              .filter((r) => r.attempted > 0)
              .slice(0, 5);
            return (
              <div key={k} className="mb-4 last:mb-0">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold uppercase">{k}</span>
                  <span className="text-xs text-neutral-600">
                    班级平均正确率{" "}
                    <strong className="text-neutral-900">{classAcc}%</strong> (
                    {totalAttempted} 次答题)
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full ${
                      classAcc >= 80
                        ? "bg-green-600"
                        : classAcc >= 50
                          ? "bg-amber-500"
                          : "bg-red-600"
                    }`}
                    style={{ width: `${classAcc}%` }}
                  />
                </div>
                {rows.length > 0 ? (
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <div className="mb-1 font-semibold text-green-700">
                        正确率前 5
                      </div>
                      <ul className="space-y-0.5">
                        {top.map((r) => (
                          <li
                            key={r.userId}
                            className="flex justify-between gap-2"
                          >
                            <span className="truncate">{r.userName}</span>
                            <span className="shrink-0 font-mono text-neutral-500">
                              {Math.round(r.accuracy * 100)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-1 font-semibold text-red-700">
                        需关注 (后 5)
                      </div>
                      <ul className="space-y-0.5">
                        {bottom.length > 0 ? (
                          bottom.map((r) => (
                            <li
                              key={r.userId}
                              className="flex justify-between gap-2"
                            >
                              <span className="truncate">{r.userName}</span>
                              <span className="shrink-0 font-mono text-neutral-500">
                                {Math.round(r.accuracy * 100)}%
                              </span>
                            </li>
                          ))
                        ) : (
                          <li className="text-neutral-400">尚无答题学生</li>
                        )}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-neutral-400">
                    班级还没有学生。
                  </p>
                )}
                {weakTopics.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-xs font-semibold text-amber-700">
                      常见薄弱主题
                    </div>
                    <ul className="space-y-1 text-xs">
                      {weakTopics.map((t) => (
                        <li
                          key={t.topicId}
                          className="flex items-center justify-between"
                        >
                          <span className="truncate">{t.labelZh}</span>
                          <span className="shrink-0 font-mono text-neutral-500">
                            {Math.round(t.classAccuracy * 100)}% (
                            {t.classAttempts}次)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Assignments */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-extrabold">
            <span className="marker-yellow">作业</span>
          </h2>
          <Link
            href={`/teacher/classes/${cls.id}/assignments/new`}
            className="rounded-full bg-ink px-3 py-1.5 text-sm font-extrabold text-white hover:bg-ink/90 transition"
          >
            + 布置新作业
          </Link>
        </div>
        {assignments.length === 0 ? (
          <div className="mb-8 rounded-2xl border-2 border-dashed border-ink/15 p-6 text-center text-sm font-medium text-ink/60">
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
                  className="rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold">{a.title}</span>
                        <span className="pill-tag bg-cream-soft border-2 border-ink/15 text-ink/70">
                          {a.examType} {kindZh}
                          {a.part != null && ` Part ${a.part}`}
                        </span>
                        {a.minScore != null && (
                          <span className="pill-tag bg-sky-soft border-2 border-ink/15">
                            ≥ {a.minScore}%
                          </span>
                        )}
                        {a.dueAt && (
                          <span
                            className={
                              overdue
                                ? "pill-tag bg-peach-soft border-2 border-ink/15"
                                : "pill-tag bg-cream-soft border-2 border-ink/15 text-ink/70"
                            }
                          >
                            截止 {a.dueAt.toLocaleDateString("zh-CN")}
                          </span>
                        )}
                      </div>
                      {a.description && (
                        <p className="mt-1 text-xs font-medium text-ink/60">
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
                        className="rounded-full border-2 border-ink/15 bg-white px-2 py-1 text-xs font-bold text-ink/60 hover:bg-red-50 hover:text-red-700 transition"
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
        <h2 className="mb-3 text-xl sm:text-2xl font-extrabold">
          <span className="marker-yellow">学生名单</span>
        </h2>
        {cls.members.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center text-sm font-medium text-ink/60">
            暂无学生。分享邀请码{" "}
            <span className="font-mono font-extrabold">{cls.inviteCode}</span>{" "}
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
                  className="flex flex-col gap-2 rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">
                      {m.user.name ?? m.user.email}
                    </div>
                    <div className="text-xs font-medium text-ink/55">
                      {m.user.email} · 加入于{" "}
                      {m.joinedAt.toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {stats ? (
                      <>
                        <div className="text-right">
                          <div>
                            <span className="text-ink/55">已批改 </span>
                            <span className="font-extrabold">
                              {stats._count}
                            </span>
                            <span className="text-ink/55"> 份</span>
                          </div>
                          <div className="text-xs font-medium text-ink/60">
                            平均 {avg}% · 最高{" "}
                            {stats._max.scaledScore ?? 0}%
                          </div>
                          <div className="mt-0.5 text-xs text-purple-700">
                            听力{" "}
                            {listeningStats ? (
                              <>
                                <span className="font-extrabold">
                                  {listeningStats._count}
                                </span>
                                <span className="text-purple-600/70"> 份 · 平均 </span>
                                <span className="font-extrabold">
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
                                <span className="font-extrabold">
                                  {speakingStats._count}
                                </span>
                                <span className="text-emerald-600/70">
                                  {" "}
                                  份 · 平均{" "}
                                </span>
                                <span className="font-extrabold">
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
                      <span className="text-xs font-medium text-ink/40">
                        还没有完成任何答卷
                      </span>
                    )}
                    <Link
                      href={`/teacher/classes/${cls.id}/students/${m.userId}`}
                      className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-bold hover:bg-ink/5 transition"
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
        <h2 className="mb-3 text-xl sm:text-2xl font-extrabold">
          <span className="marker-yellow">最近活动</span>
        </h2>

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
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center text-sm font-medium text-ink/60">
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
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white border-2 border-ink/10 p-3 stitched-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-extrabold">
                        {a.user.name ?? a.user.email}
                      </span>
                      <span className="text-ink/40"> · </span>
                      <span>
                        {a.test.examType} {kindZh}
                        {a.test.part != null && ` Part ${a.test.part}`}
                      </span>
                      {a.status === "GRADED" &&
                        a.scaledScore !== null && (
                          <span className="ml-2 font-mono text-ink/70">
                            {a.scaledScore}%
                          </span>
                        )}
                    </div>
                    <div className="text-xs font-medium text-ink/40">
                      {formatDateTime(a.startedAt)}
                    </div>
                  </div>
                  <span className={`shrink-0 ${statusMeta.className}`}>
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
