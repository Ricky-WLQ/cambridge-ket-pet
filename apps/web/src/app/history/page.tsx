import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import GateBanner from "@/components/diagnose/GateBanner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redoAttemptAction } from "@/lib/attemptActions";
import FiltersBar from "./FiltersBar";

type AttemptRow = {
  id: string;
  startedAt: Date;
  submittedAt: Date | null;
  status: "IN_PROGRESS" | "SUBMITTED" | "GRADED" | "ABANDONED";
  mode: "PRACTICE" | "MOCK";
  rawScore: number | null;
  totalPossible: number | null;
  scaledScore: number | null;
  test: {
    id: string;
    examType: "KET" | "PET";
    kind:
      | "READING"
      | "WRITING"
      | "LISTENING"
      | "SPEAKING"
      | "MOCK_FULL"
      | "MOCK_SECTION";
    part: number | null;
  };
};

const KIND_ZH: Record<AttemptRow["test"]["kind"], string> = {
  READING: "阅读",
  WRITING: "写作",
  LISTENING: "听力",
  SPEAKING: "口语",
  MOCK_FULL: "全套模拟",
  MOCK_SECTION: "单项模拟",
};

const MODE_ZH: Record<AttemptRow["mode"], string> = {
  PRACTICE: "练习",
  MOCK: "模拟",
};

const STATUS_ZH: Record<
  AttemptRow["status"],
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

function kindPathFor(kind: AttemptRow["test"]["kind"]): string {
  if (kind === "WRITING") return "writing";
  if (kind === "LISTENING") return "listening";
  if (kind === "SPEAKING") return "speaking";
  return "reading";
}

function runnerUrl(row: AttemptRow): string {
  const portal = row.test.examType === "KET" ? "ket" : "pet";
  return `/${portal}/${kindPathFor(row.test.kind)}/runner/${row.id}`;
}

function resultUrl(row: AttemptRow): string {
  const portal = row.test.examType === "KET" ? "ket" : "pet";
  return `/${portal}/${kindPathFor(row.test.kind)}/result/${row.id}`;
}

function formatDate(d: Date): string {
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const EXAM_VALUES = ["KET", "PET"] as const;
const KIND_VALUES = [
  "READING",
  "WRITING",
  "LISTENING",
  "SPEAKING",
  "MOCK_FULL",
  "MOCK_SECTION",
] as const;
const MODE_VALUES = ["PRACTICE", "MOCK"] as const;
const STATUS_VALUES = [
  "IN_PROGRESS",
  "SUBMITTED",
  "GRADED",
  "ABANDONED",
] as const;

type SearchParams = {
  examType?: string;
  kind?: string;
  mode?: string;
  status?: string;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // I9: surface the diagnose-gate banner at the top of /history. The banner
  // links to /diagnose so a gated user can finish this week's diagnose to
  // unblock the rest of the app. Read from the JWT cache (no DB hit).
  const requiredDiagnoseId = (
    session?.user as { requiredDiagnoseId?: string | null } | undefined
  )?.requiredDiagnoseId ?? null;

  const where: Prisma.TestAttemptWhereInput = { userId };
  if (sp.status && (STATUS_VALUES as readonly string[]).includes(sp.status)) {
    where.status = sp.status as (typeof STATUS_VALUES)[number];
  }
  if (sp.mode && (MODE_VALUES as readonly string[]).includes(sp.mode)) {
    where.mode = sp.mode as (typeof MODE_VALUES)[number];
  }
  // DIAGNOSE attempts live under /diagnose/history (per-section replay /
  // overall report). Excluding them here prevents them from rendering in
  // the regular history grid where the result-link template doesn't know
  // how to view them — kindPathFor() defaults DIAGNOSE -> "reading", which
  // produced a 500 / blank breakdown previously.
  const testFilter: Prisma.TestWhereInput = { kind: { not: "DIAGNOSE" } };
  if (sp.examType && (EXAM_VALUES as readonly string[]).includes(sp.examType)) {
    testFilter.examType = sp.examType as (typeof EXAM_VALUES)[number];
  }
  if (sp.kind && (KIND_VALUES as readonly string[]).includes(sp.kind)) {
    testFilter.kind = sp.kind as (typeof KIND_VALUES)[number];
  }
  where.test = testFilter;

  const [attempts, mistakeCount, comments] = await Promise.all([
    prisma.testAttempt.findMany({
      where,
      include: {
        test: {
          select: { id: true, examType: true, kind: true, part: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 100,
    }) as Promise<AttemptRow[]>,
    prisma.mistakeNote.count({
      where: { userId, status: "NEW" },
    }),
    prisma.comment.findMany({
      where: { targetUserId: userId },
      include: {
        author: { select: { name: true, email: true } },
        class: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const filteredCount = attempts.length;
  const hasAnyFilter = !!(sp.examType || sp.kind || sp.mode || sp.status);

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        {requiredDiagnoseId && (
          <GateBanner requiredDiagnoseId={requiredDiagnoseId} />
        )}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-[1.05] tracking-tight">
            <span className="marker-yellow-thick">历史记录</span>
          </h1>
          <Link
            href="/history/mistakes"
            className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-sm font-extrabold text-white stitched-card transition hover:bg-amber-600"
          >
            <span aria-hidden>📒</span>
            <span>错题本</span>
            {mistakeCount > 0 && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700">
                {mistakeCount} 待复习
              </span>
            )}
          </Link>
        </div>
        <p className="mb-4 text-base sm:text-lg text-ink/75 leading-relaxed">
          你所有的练习和模拟考试，最多展示 100 条。使用下方筛选缩小范围。
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink/60">快速跳转：</span>
          <Link
            href="/ket"
            className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
          >
            KET 门户
          </Link>
          <Link
            href="/pet"
            className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
          >
            PET 门户
          </Link>
        </div>

        {comments.length > 0 && (
          <div className="mb-6 rounded-2xl border-2 border-ink/10 bg-sky-tint p-4 stitched-card">
            <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
              <span aria-hidden>💬</span>
              老师的留言
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink">
                {comments.length}
              </span>
            </div>
            <ul className="space-y-2">
              {comments.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border-2 border-ink/10 bg-white p-3"
                >
                  <div className="text-xs text-ink/60">
                    {c.author.name ?? c.author.email} · {c.class.name} ·{" "}
                    {c.createdAt.toLocaleString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
            {comments.length > 5 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-bold text-ink/70 hover:text-ink">
                  查看更多留言（{comments.length - 5} 条）
                </summary>
                <ul className="mt-2 space-y-2">
                  {comments.slice(5).map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border-2 border-ink/10 bg-white p-3"
                    >
                      <div className="text-xs text-ink/60">
                        {c.author.name ?? c.author.email} · {c.class.name} ·{" "}
                        {c.createdAt.toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">
                        {c.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <FiltersBar />

        {hasAnyFilter && (
          <p className="mb-4 text-xs font-bold text-ink/60">
            当前筛选共 {filteredCount} 条记录
          </p>
        )}

        {attempts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-10 text-center">
            <p className="text-sm text-ink/60">
              {hasAnyFilter
                ? "当前筛选下没有记录。"
                : "还没有任何答卷。"}
            </p>
            {!hasAnyFilter && (
              <div className="mt-4 flex justify-center gap-2">
                <Link
                  href="/ket"
                  className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold hover:bg-ink/5 transition"
                >
                  去 KET
                </Link>
                <Link
                  href="/pet"
                  className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold hover:bg-ink/5 transition"
                >
                  去 PET
                </Link>
              </div>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {attempts.map((a) => {
              const statusMeta = STATUS_ZH[a.status];
              const part = a.test.part ?? 0;
              const kind = KIND_ZH[a.test.kind] ?? a.test.kind;
              const isListening = a.test.kind === "LISTENING";
              const isSpeaking = a.test.kind === "SPEAKING";
              const partLabel = isSpeaking
                ? "全程对话"
                : isListening
                  ? a.test.part === null || a.test.part === undefined
                    ? "完整模考"
                    : `第 ${a.test.part} 部分`
                  : `Part ${part}`;
              const scoreText = isListening
                ? a.rawScore !== null && a.totalPossible !== null
                  ? `${a.rawScore}/${a.totalPossible}`
                  : null
                : a.rawScore !== null &&
                    a.totalPossible !== null &&
                    a.scaledScore !== null
                  ? `${a.rawScore}/${a.totalPossible} · ${a.scaledScore}%`
                  : null;

              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">
                        {a.test.examType}
                      </span>
                      <span className="font-bold">
                        {kind} · {partLabel}
                      </span>
                      <span className="pill-tag bg-cream-soft border-2 border-ink/15 text-ink/70">
                        {MODE_ZH[a.mode]}
                      </span>
                      <span className={statusMeta.className}>
                        {statusMeta.label}
                      </span>
                      {scoreText && (
                        <span className="font-mono text-sm text-ink/70">
                          {scoreText}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-ink/50">
                      {formatDate(a.startedAt)}
                      {a.submittedAt && (
                        <> · 提交于 {formatDate(a.submittedAt)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.status === "IN_PROGRESS" && (
                      <Link
                        href={runnerUrl(a)}
                        className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-bold hover:bg-ink/5 transition"
                      >
                        继续作答
                      </Link>
                    )}
                    {(a.status === "GRADED" || a.status === "SUBMITTED") && (
                      <>
                        <Link
                          href={resultUrl(a)}
                          className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-bold hover:bg-ink/5 transition"
                        >
                          查看结果
                        </Link>
                        <form action={redoAttemptAction}>
                          <input
                            type="hidden"
                            name="attemptId"
                            value={a.id}
                          />
                          <button
                            type="submit"
                            className="rounded-full bg-ink px-3 py-1.5 text-xs font-extrabold text-white hover:bg-ink/90 transition"
                          >
                            再做一次
                          </button>
                        </form>
                      </>
                    )}
                    {a.status === "ABANDONED" && (
                      <form action={redoAttemptAction}>
                        <input type="hidden" name="attemptId" value={a.id} />
                        <button
                          type="submit"
                          className="rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-xs font-bold hover:bg-ink/5 transition"
                        >
                          重新开始
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
