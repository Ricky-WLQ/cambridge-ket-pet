import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MASTERY_MASTERED_THRESHOLD } from "@/lib/vocab/srs";
import AnalysisPanel from "./AnalysisPanel";
import CommentPanel, { type CommentItem } from "./CommentPanel";
import ScoreTrend from "./ScoreTrend";

type WordTierKey = "CORE" | "RECOMMENDED" | "EXTRA";

interface StudentVocabTier {
  examType: "KET" | "PET";
  totalByTier: Record<WordTierKey, number>;
  masteredByTier: Record<WordTierKey, number>;
}

interface StudentVocabSummary {
  tiers: StudentVocabTier[];
  sparkline: number[];
}

async function getStudentVocabSummary(
  userId: string,
): Promise<StudentVocabSummary> {
  const tiers = await Promise.all(
    (["KET", "PET"] as const).map(async (examType) => {
      const totals = await prisma.word.groupBy({
        by: ["tier"],
        where: { examType },
        _count: { _all: true },
      });
      const mastered = await prisma.vocabProgress.findMany({
        where: {
          userId,
          examType,
          mastery: { gte: MASTERY_MASTERED_THRESHOLD },
        },
        select: { wordRef: { select: { tier: true } } },
      });
      const masteredByTier: Record<WordTierKey, number> = {
        CORE: 0,
        RECOMMENDED: 0,
        EXTRA: 0,
      };
      for (const r of mastered) {
        if (r.wordRef) masteredByTier[r.wordRef.tier]++;
      }
      const totalByTier: Record<WordTierKey, number> = {
        CORE: 0,
        RECOMMENDED: 0,
        EXTRA: 0,
      };
      for (const t of totals) {
        totalByTier[t.tier as WordTierKey] = t._count._all;
      }
      return { examType, totalByTier, masteredByTier };
    }),
  );
  // 30-day sparkline — count of mastery-bumps per day (most recent on the right)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const recent = await prisma.vocabProgress.findMany({
    where: { userId, lastReviewed: { gte: since } },
    select: { lastReviewed: true, mastery: true },
  });
  const byDay = new Array(30).fill(0);
  for (const r of recent) {
    if (!r.lastReviewed) continue;
    const dayIdx = Math.floor(
      (Date.now() - r.lastReviewed.getTime()) / (24 * 60 * 60_000),
    );
    if (dayIdx >= 0 && dayIdx < 30) byDay[29 - dayIdx]++;
  }
  return { tiers, sparkline: byDay };
}

interface StudentGrammarTopic {
  topicId: string;
  labelZh: string;
  category: string;
  attempted: number;
  correct: number;
  accuracy: number;
}

interface StudentGrammarTier {
  examType: "KET" | "PET";
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;
  perTopic: StudentGrammarTopic[];
}

interface StudentGrammarSummary {
  tiers: StudentGrammarTier[];
  sparkline: number[];
}

async function getStudentGrammarSummary(
  userId: string,
): Promise<StudentGrammarSummary> {
  const tiers = await Promise.all(
    (["KET", "PET"] as const).map(async (examType) => {
      const rows = await prisma.grammarProgress.findMany({
        where: { userId, examType },
        select: { topicId: true, isCorrect: true },
      });
      const totalAttempted = rows.length;
      const totalCorrect = rows.filter((r) => r.isCorrect).length;
      const accuracy = totalAttempted === 0 ? 0 : totalCorrect / totalAttempted;
      const perTopicMap = new Map<
        string,
        { attempted: number; correct: number }
      >();
      for (const r of rows) {
        const cur = perTopicMap.get(r.topicId) ?? { attempted: 0, correct: 0 };
        cur.attempted++;
        if (r.isCorrect) cur.correct++;
        perTopicMap.set(r.topicId, cur);
      }
      const topicMeta = await prisma.grammarTopic.findMany({
        where: { examType, id: { in: Array.from(perTopicMap.keys()) } },
        select: { id: true, labelZh: true, category: true },
      });
      const labelMap = new Map(
        topicMeta.map((t) => [
          t.id,
          { labelZh: t.labelZh, category: t.category },
        ]),
      );
      const perTopic: StudentGrammarTopic[] = Array.from(perTopicMap.entries())
        .map(([topicId, c]) => {
          const meta = labelMap.get(topicId);
          return {
            topicId,
            labelZh: meta?.labelZh ?? topicId,
            category: meta?.category ?? "",
            attempted: c.attempted,
            correct: c.correct,
            accuracy: c.attempted === 0 ? 0 : c.correct / c.attempted,
          };
        })
        .sort((a, b) => b.attempted - a.attempted);
      return {
        examType: examType as "KET" | "PET",
        totalAttempted,
        totalCorrect,
        accuracy,
        perTopic,
      };
    }),
  );
  // 30-day sparkline — count of attempts per day
  const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const recent = await prisma.grammarProgress.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, isCorrect: true },
  });
  const byDay = new Array(30).fill(0);
  for (const r of recent) {
    const dayIdx = Math.floor(
      (Date.now() - r.createdAt.getTime()) / (24 * 60 * 60_000),
    );
    if (dayIdx >= 0 && dayIdx < 30) byDay[29 - dayIdx]++;
  }
  return { tiers, sparkline: byDay };
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
  IN_PROGRESS: { label: "进行中", className: "bg-amber-100 text-amber-800" },
  SUBMITTED: { label: "已提交", className: "bg-blue-100 text-blue-800" },
  GRADED: { label: "已批改", className: "bg-green-100 text-green-800" },
  ABANDONED: { label: "已放弃", className: "bg-neutral-100 text-neutral-600" },
};

const NOTE_STATUS_META: Record<
  "NEW" | "REVIEWED" | "MASTERED",
  { label: string; className: string }
> = {
  NEW: { label: "新错题", className: "bg-red-100 text-red-800" },
  REVIEWED: { label: "已复习", className: "bg-amber-100 text-amber-800" },
  MASTERED: { label: "已掌握", className: "bg-green-100 text-green-800" },
};

const WRITING_CRITERIA: Array<{
  key: "content" | "communicative" | "organisation" | "language";
  labelZh: string;
}> = [
  { key: "content", labelZh: "内容" },
  { key: "communicative", labelZh: "沟通" },
  { key: "organisation", labelZh: "结构" },
  { key: "language", labelZh: "语言" },
];

function formatDate(d: Date): string {
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 p-4 text-center">
      <div className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function scoreBarColor(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(pct: number): string {
  if (pct >= 70) return "text-green-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

type WritingStored = {
  scores?: {
    content?: number;
    communicative?: number;
    organisation?: number;
    language?: number;
  };
};

type SpeakingRubricStored = {
  grammarVocab?: number;
  discourseManagement?: number;
  pronunciation?: number;
  interactive?: number;
};

const SPEAKING_CRITERIA: Array<{
  key: keyof Required<SpeakingRubricStored>;
  labelZh: string;
  labelEn: string;
}> = [
  { key: "grammarVocab", labelZh: "语法词汇", labelEn: "Grammar & Vocab" },
  {
    key: "discourseManagement",
    labelZh: "话语连贯",
    labelEn: "Discourse Mgmt",
  },
  { key: "pronunciation", labelZh: "发音", labelEn: "Pronunciation" },
  { key: "interactive", labelZh: "互动", labelEn: "Interactive" },
];

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, examFocus: true },
  });
  if (!cls || cls.teacherId !== userId) notFound();

  const membership = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId: studentId } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      },
    },
  });
  if (!membership) notFound();

  const student = membership.user;

  const commentsDb = await prisma.comment.findMany({
    where: { classId, targetUserId: studentId },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const comments: CommentItem[] = commentsDb.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt.toISOString(),
    authorName: c.author.name ?? c.author.email,
    authorId: c.authorId,
  }));

  const [attempts, aggregate, perKind, mistakeByStatus, mistakesByExamPoint] =
    await Promise.all([
      prisma.testAttempt.findMany({
        where: { userId: studentId },
        include: {
          test: {
            select: { examType: true, kind: true, part: true },
          },
        },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      prisma.testAttempt.aggregate({
        where: { userId: studentId, status: "GRADED" },
        _count: true,
        _avg: { scaledScore: true },
        _max: { scaledScore: true },
      }),
      prisma.$queryRaw<
        Array<{ examType: string; kind: string; count: bigint; avg: number | null }>
      >`
      SELECT t."examType" AS "examType", t.kind AS "kind",
             COUNT(ta.id)::bigint AS "count",
             AVG(ta."scaledScore") AS "avg"
      FROM "TestAttempt" ta
      JOIN "Test" t ON t.id = ta."testId"
      WHERE ta."userId" = ${studentId} AND ta.status = 'GRADED'
      GROUP BY t."examType", t.kind
      ORDER BY t."examType", t.kind
    `,
      prisma.mistakeNote.groupBy({
        by: ["status"],
        where: { userId: studentId },
        _count: true,
      }),
      prisma.mistakeNote.groupBy({
        by: ["examPointId"],
        where: { userId: studentId, examPointId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const topMistakesByExamPoint = [...mistakesByExamPoint]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8);

  const mistakeCounts = Object.fromEntries(
    mistakeByStatus.map((m) => [m.status, m._count]),
  ) as Partial<Record<"NEW" | "REVIEWED" | "MASTERED", number>>;
  const totalMistakes =
    (mistakeCounts.NEW ?? 0) +
    (mistakeCounts.REVIEWED ?? 0) +
    (mistakeCounts.MASTERED ?? 0);

  // Score-trend source: all graded attempts (component handles filter + slice)
  const trendAttempts = attempts
    .filter(
      (a): a is typeof a & { scaledScore: number } =>
        a.status === "GRADED" && a.scaledScore !== null,
    )
    .map((a) => ({
      id: a.id,
      examType: a.test.examType,
      kind: a.test.kind,
      part: a.test.part,
      scaledScore: a.scaledScore,
      startedAt: a.startedAt.toISOString(),
    }));

  // Listening per-part averages (graded listening attempts, grouped by Test.part)
  const listeningAttempts = attempts.filter(
    (a) =>
      a.status === "GRADED" &&
      a.test.kind === "LISTENING" &&
      a.scaledScore !== null,
  );
  const listeningBreakdown = (() => {
    if (listeningAttempts.length === 0) return null;
    const byPart = new Map<number | "FULL", { sum: number; count: number }>();
    for (const a of listeningAttempts) {
      const key: number | "FULL" = a.test.part ?? "FULL";
      const bucket = byPart.get(key) ?? { sum: 0, count: 0 };
      bucket.sum += a.scaledScore as number;
      bucket.count += 1;
      byPart.set(key, bucket);
    }
    const parts = Array.from(byPart.entries())
      .map(([key, { sum, count }]) => ({
        key,
        avg: Math.round(sum / count),
        count,
      }))
      .sort((x, y) => {
        if (x.key === "FULL") return 1;
        if (y.key === "FULL") return -1;
        return (x.key as number) - (y.key as number);
      });
    return { parts, total: listeningAttempts.length };
  })();

  // Speaking rubric averages (across SCORED speaking attempts)
  const speakingAttempts = attempts.filter(
    (a) =>
      a.status === "GRADED" &&
      a.test.kind === "SPEAKING" &&
      a.rubricScores !== null,
  );
  const speakingAverages = (() => {
    if (speakingAttempts.length === 0) return null;
    const sums = {
      grammarVocab: 0,
      discourseManagement: 0,
      pronunciation: 0,
      interactive: 0,
    };
    let n = 0;
    for (const a of speakingAttempts) {
      const r = a.rubricScores as SpeakingRubricStored | null;
      if (!r) continue;
      sums.grammarVocab += r.grammarVocab ?? 0;
      sums.discourseManagement += r.discourseManagement ?? 0;
      sums.pronunciation += r.pronunciation ?? 0;
      sums.interactive += r.interactive ?? 0;
      n += 1;
    }
    if (n === 0) return null;
    const avgs = {
      grammarVocab: sums.grammarVocab / n,
      discourseManagement: sums.discourseManagement / n,
      pronunciation: sums.pronunciation / n,
      interactive: sums.interactive / n,
    };
    // Weakest criterion = lowest average; report key + label.
    const weakestKey = (
      Object.keys(avgs) as Array<keyof typeof avgs>
    ).reduce((min, k) => (avgs[k] < avgs[min] ? k : min));
    const weakest = SPEAKING_CRITERIA.find((c) => c.key === weakestKey)!;
    return { ...avgs, count: n, weakestKey, weakestLabel: weakest.labelZh };
  })();

  // Writing rubric averages (across all graded writing attempts)
  const writingAttempts = attempts.filter(
    (a) => a.status === "GRADED" && a.test.kind === "WRITING",
  );
  const writingAverages = (() => {
    if (writingAttempts.length === 0) return null;
    const sums = { content: 0, communicative: 0, organisation: 0, language: 0 };
    let n = 0;
    for (const a of writingAttempts) {
      const stored = a.weakPoints as WritingStored | null;
      const s = stored?.scores;
      if (!s) continue;
      sums.content += s.content ?? 0;
      sums.communicative += s.communicative ?? 0;
      sums.organisation += s.organisation ?? 0;
      sums.language += s.language ?? 0;
      n += 1;
    }
    if (n === 0) return null;
    return {
      content: sums.content / n,
      communicative: sums.communicative / n,
      organisation: sums.organisation / n,
      language: sums.language / n,
      count: n,
    };
  })();

  const vocabData = await getStudentVocabSummary(studentId);
  const grammarData = await getStudentGrammarSummary(studentId);

  // Enrich exam-point labels for the mistake breakdown
  const mistakeExamPointIds = topMistakesByExamPoint
    .map((m) => m.examPointId)
    .filter((x): x is string => x !== null);
  const examPointLabels = await prisma.examPoint.findMany({
    where: { id: { in: mistakeExamPointIds } },
    select: { id: true, label: true, descriptionZh: true },
  });
  const examPointLabelMap = new Map(
    examPointLabels.map((ep) => [ep.id, ep.descriptionZh || ep.label]),
  );
  const maxMistakeCount =
    topMistakesByExamPoint.reduce((mx, m) => Math.max(mx, m._count._all), 0) ||
    1;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <Link
          href={`/teacher/classes/${cls.id}`}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100"
        >
          <span aria-hidden>←</span> 返回 {cls.name}
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {student.name ?? student.email}
        </h1>
        <p className="text-sm text-neutral-500">
          {student.email} · 加入于{" "}
          {membership.joinedAt.toLocaleDateString("zh-CN")}
        </p>

        <div className="mt-6">
          <AnalysisPanel
            classId={cls.id}
            studentId={studentId}
            studentName={student.name ?? student.email}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatCard label="已批改答卷" value={aggregate._count} />
          <StatCard
            label="平均分"
            value={
              aggregate._avg.scaledScore !== null
                ? `${Math.round(aggregate._avg.scaledScore)}%`
                : "—"
            }
          />
          <StatCard
            label="最高分"
            value={
              aggregate._max.scaledScore !== null
                ? `${aggregate._max.scaledScore}%`
                : "—"
            }
          />
          <StatCard label="错题总数" value={totalMistakes} />
        </div>

        {trendAttempts.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">最近成绩走势</h2>
            <ScoreTrend
              attempts={trendAttempts}
              classId={cls.id}
              studentId={studentId}
            />
          </>
        )}

        {perKind.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">按科目 × 题型分布</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {perKind.map((k) => {
                const avg = k.avg !== null ? Math.round(k.avg) : null;
                const kindZh = KIND_ZH[k.kind] ?? k.kind;
                return (
                  <li
                    key={`${k.examType}-${k.kind}`}
                    className="rounded-md border border-neutral-200 p-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {k.examType} {kindZh}
                      </span>
                      <span className="text-neutral-600">
                        {Number(k.count)} 份 ·{" "}
                        <span
                          className={avg !== null ? scoreTextColor(avg) : ""}
                        >
                          平均 {avg !== null ? `${avg}%` : "—"}
                        </span>
                      </span>
                    </div>
                    {avg !== null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className={`h-full ${scoreBarColor(avg)}`}
                          style={{ width: `${Math.min(avg, 100)}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {writingAverages && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">
              写作四项能力平均
              <span className="ml-2 text-sm font-normal text-neutral-500">
                （共 {writingAverages.count} 份）
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {WRITING_CRITERIA.map((c) => {
                const avg = writingAverages[c.key];
                const pct = Math.round((avg / 5) * 100);
                return (
                  <div
                    key={c.key}
                    className="rounded-md border border-neutral-200 p-4"
                  >
                    <div className="text-xs text-neutral-500">{c.labelZh}</div>
                    <div
                      className={`mt-1 text-2xl font-bold ${scoreTextColor(pct)}`}
                    >
                      {avg.toFixed(1)}
                      <span className="text-sm font-normal text-neutral-400">
                        {" "}
                        / 5
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full ${scoreBarColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {speakingAverages && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">
              口语分项平均
              <span className="ml-2 text-sm font-normal text-neutral-500">
                （共 {speakingAverages.count} 份 · 最弱:
                {speakingAverages.weakestLabel}）
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {SPEAKING_CRITERIA.map((c) => {
                const avg = speakingAverages[c.key] as number;
                const pct = Math.round((avg / 5) * 100);
                const isWeakest = c.key === speakingAverages.weakestKey;
                return (
                  <div
                    key={c.key}
                    className={`rounded-md border p-4 ${
                      isWeakest
                        ? "border-amber-300 bg-amber-50/50"
                        : "border-emerald-200 bg-emerald-50/30"
                    }`}
                  >
                    <div
                      className={`text-xs ${
                        isWeakest ? "text-amber-800" : "text-emerald-800"
                      }`}
                    >
                      {c.labelZh}
                      <span className="ml-1 text-neutral-400">
                        · {c.labelEn}
                      </span>
                    </div>
                    <div
                      className={`mt-1 text-2xl font-bold ${scoreTextColor(pct)}`}
                    >
                      {avg.toFixed(1)}
                      <span className="text-sm font-normal text-neutral-400">
                        {" "}
                        / 5
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full ${scoreBarColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {listeningBreakdown && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">
              听力分项平均
              <span className="ml-2 text-sm font-normal text-neutral-500">
                （共 {listeningBreakdown.total} 份）
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-4">
              {listeningBreakdown.parts.map((p) => {
                const title = p.key === "FULL" ? "全套" : `Part ${p.key}`;
                return (
                  <div
                    key={String(p.key)}
                    className="rounded-md border border-purple-200 bg-purple-50/30 p-4"
                  >
                    <div className="text-xs text-purple-700">{title}</div>
                    <div className={`mt-1 text-2xl font-bold ${scoreTextColor(p.avg)}`}>
                      {p.avg}
                      <span className="text-sm font-normal text-neutral-400">
                        {" "}
                        %
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {p.count} 份
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className={`h-full ${scoreBarColor(p.avg)}`}
                        style={{ width: `${Math.min(p.avg, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 className="mt-8 mb-3 text-lg font-semibold">词汇练习</h2>
        <div className="rounded-md border border-neutral-200 p-4">
          {vocabData.tiers.map((t) => (
            <div key={t.examType} className="mb-3 last:mb-0">
              <div className="mb-1 text-sm font-medium uppercase">
                {t.examType}
              </div>
              <div className="grid gap-2 text-xs sm:grid-cols-3">
                {(["CORE", "RECOMMENDED", "EXTRA"] as const).map((tier) => (
                  <div key={tier}>
                    <div className="text-neutral-500">{tier}</div>
                    <div className="font-semibold">
                      {t.masteredByTier[tier]} / {t.totalByTier[tier]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-3">
            <div className="mb-1 text-xs text-neutral-500">近 30 天活跃度</div>
            <div className="flex gap-px">
              {vocabData.sparkline.map((n, i) => (
                <div
                  key={i}
                  className="h-6 flex-1"
                  style={{
                    background:
                      n === 0
                        ? "#f5f5f5"
                        : `rgba(22, 163, 74, ${Math.min(1, 0.2 + n / 10)})`,
                  }}
                  title={`${30 - i} 天前: ${n} 次复习`}
                />
              ))}
            </div>
          </div>
        </div>

        <h2 className="mt-8 mb-3 text-lg font-semibold">语法练习</h2>
        <div className="rounded-md border border-neutral-200 p-4">
          {grammarData.tiers.map((t) => (
            <div key={t.examType} className="mb-4 last:mb-0">
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="font-medium uppercase">{t.examType}</span>
                <span className="text-neutral-600">
                  {t.totalAttempted} 次答题 · 正确率{" "}
                  <strong>{Math.round(t.accuracy * 100)}%</strong>
                </span>
              </div>
              {t.perTopic.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {t.perTopic.slice(0, 6).map((tp) => {
                    const pct = Math.round(tp.accuracy * 100);
                    const colorClass =
                      pct >= 80
                        ? "bg-green-500"
                        : pct >= 50
                          ? "bg-amber-500"
                          : "bg-red-500";
                    return (
                      <li
                        key={tp.topicId}
                        className="flex items-center gap-2"
                      >
                        <span className="w-32 shrink-0 truncate text-neutral-700">
                          {tp.labelZh}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className={`h-full ${colorClass}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-14 text-right font-mono text-neutral-500">
                          {tp.correct}/{tp.attempted}
                        </span>
                      </li>
                    );
                  })}
                  {t.perTopic.length > 6 && (
                    <li className="text-neutral-400">
                      … 还有 {t.perTopic.length - 6} 个主题
                    </li>
                  )}
                </ul>
              ) : (
                <div className="text-xs text-neutral-500">未练习</div>
              )}
            </div>
          ))}
          <div className="mt-3">
            <div className="mb-1 text-xs text-neutral-500">
              近 30 天答题活跃度
            </div>
            <div className="flex gap-px">
              {grammarData.sparkline.map((n, i) => (
                <div
                  key={i}
                  className="h-6 flex-1"
                  style={{
                    background:
                      n === 0
                        ? "#f5f5f5"
                        : `rgba(37, 99, 235, ${Math.min(1, 0.2 + n / 10)})`,
                  }}
                  title={`${30 - i} 天前: ${n} 次答题`}
                />
              ))}
            </div>
          </div>
        </div>

        {topMistakesByExamPoint.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">高频错误考点</h2>
            <ul className="space-y-2">
              {topMistakesByExamPoint.map((m) => {
                const id = m.examPointId as string;
                const label = examPointLabelMap.get(id) ?? id;
                const count = m._count._all;
                const widthPct = Math.round((count / maxMistakeCount) * 100);
                return (
                  <li key={id} className="rounded-md border border-neutral-200 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        <span className="font-mono text-xs text-neutral-500">
                          {id}
                        </span>
                        {label !== id && <> · {label}</>}
                      </span>
                      <span className="ml-3 shrink-0 text-sm font-semibold text-red-700">
                        {count} 错
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full bg-red-400"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {totalMistakes > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-lg font-semibold">错题状态</h2>
            <div className="flex flex-wrap gap-2">
              {(["NEW", "REVIEWED", "MASTERED"] as const).map((s) => {
                const meta = NOTE_STATUS_META[s];
                const count = mistakeCounts[s] ?? 0;
                return (
                  <span
                    key={s}
                    className={`rounded-full px-3 py-1 text-sm ${meta.className}`}
                  >
                    {meta.label} · {count}
                  </span>
                );
              })}
            </div>
          </>
        )}

        <h2 className="mt-8 mb-3 text-lg font-semibold">留言记录</h2>
        <CommentPanel
          classId={cls.id}
          studentId={studentId}
          currentUserId={userId}
          comments={comments}
        />

        <h2 className="mt-8 mb-3 text-lg font-semibold">答卷记录</h2>
        {attempts.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            该学生还没有任何答卷。
          </div>
        ) : (
          <ul className="space-y-2">
            {attempts.map((a) => {
              const statusMeta = STATUS_META[a.status];
              const kindZh = KIND_ZH[a.test.kind] ?? a.test.kind;
              const scoreText =
                a.status === "GRADED" &&
                a.rawScore !== null &&
                a.totalPossible !== null &&
                a.scaledScore !== null
                  ? `${a.rawScore}/${a.totalPossible} · ${a.scaledScore}%`
                  : null;
              return (
                <li key={a.id}>
                  <Link
                    href={`/teacher/classes/${cls.id}/students/${studentId}/attempts/${a.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 transition hover:border-neutral-900 hover:shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">
                          {a.test.examType} {kindZh}
                          {a.test.part != null && ` Part ${a.test.part}`}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                        {scoreText && (
                          <span className="font-mono text-sm text-neutral-700">
                            {scoreText}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-neutral-400">
                        {formatDate(a.startedAt)}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm text-neutral-400">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
