import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusButtons from "./StatusButtons";

type Filter = "ALL" | "NEW" | "REVIEWED" | "MASTERED";
type KindFilter = "ALL" | "READING" | "WRITING" | "LISTENING";

const STATUS_META: Record<
  "NEW" | "REVIEWED" | "MASTERED",
  { label: string; className: string }
> = {
  NEW: {
    label: "新错题",
    className: "pill-tag bg-peach-soft border-2 border-ink/15",
  },
  REVIEWED: {
    label: "已复习",
    className: "pill-tag bg-butter-soft border-2 border-ink/15",
  },
  MASTERED: {
    label: "已掌握",
    className: "pill-tag bg-mint-soft border-2 border-ink/15",
  },
};

function buildMistakesHref(params: {
  status: Filter;
  kind: KindFilter;
}): string {
  const qs = new URLSearchParams();
  if (params.status !== "ALL") qs.set("status", params.status);
  if (params.kind !== "ALL") qs.set("kind", params.kind);
  const s = qs.toString();
  return s ? `/history/mistakes?${s}` : "/history/mistakes";
}

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; kind?: string }>;
}) {
  const { status, kind } = await searchParams;
  const filter: Filter =
    status === "NEW" || status === "REVIEWED" || status === "MASTERED"
      ? status
      : "ALL";
  const kindFilter: KindFilter =
    kind === "READING" || kind === "WRITING" || kind === "LISTENING"
      ? kind
      : "ALL";

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // When a kind is selected, resolve the set of attemptIds whose Test.kind
  // matches. MistakeNote has no direct Prisma relation to TestAttempt, so we
  // look up the ids via TestAttempt first and pass them as a `in` filter.
  let attemptIdFilter: Prisma.MistakeNoteWhereInput = {};
  if (kindFilter !== "ALL") {
    const matchingAttempts = await prisma.testAttempt.findMany({
      where: { userId, test: { kind: kindFilter } },
      select: { id: true },
    });
    attemptIdFilter = {
      attemptId: { in: matchingAttempts.map((a) => a.id) },
    };
  }

  const notes = await prisma.mistakeNote.findMany({
    where: {
      userId,
      ...(filter === "ALL" ? {} : { status: filter }),
      ...attemptIdFilter,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const counts = await prisma.mistakeNote.groupBy({
    by: ["status"],
    where: { userId, ...attemptIdFilter },
    _count: true,
  });
  const byStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count]),
  ) as Partial<Record<"NEW" | "REVIEWED" | "MASTERED", number>>;
  const totalCount =
    (byStatus.NEW ?? 0) + (byStatus.REVIEWED ?? 0) + (byStatus.MASTERED ?? 0);

  const chips: Array<{ value: Filter; label: string; count: number }> = [
    { value: "ALL", label: "全部", count: totalCount },
    { value: "NEW", label: "新错题", count: byStatus.NEW ?? 0 },
    { value: "REVIEWED", label: "已复习", count: byStatus.REVIEWED ?? 0 },
    { value: "MASTERED", label: "已掌握", count: byStatus.MASTERED ?? 0 },
  ];

  const kindChips: Array<{ value: KindFilter; label: string }> = [
    { value: "ALL", label: "全部题型" },
    { value: "READING", label: "阅读" },
    { value: "WRITING", label: "写作" },
    { value: "LISTENING", label: "听力" },
  ];

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-[1.05] tracking-tight">
            <span className="marker-yellow-thick">错题本</span>
          </h1>
          <Link
            href="/history"
            className="flex items-center gap-2 rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-ink/5 transition"
          >
            <span aria-hidden>←</span>
            <span>历史记录</span>
          </Link>
        </div>
        <p className="mb-6 text-base sm:text-lg text-ink/75 leading-relaxed">
          阅读练习中答错的题目会自动汇总到这里。逐题复习后可标记为「已复习」，完全掌握后再标记为「已掌握」。
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = filter === c.value;
            const href = buildMistakesHref({
              status: c.value,
              kind: kindFilter,
            });
            return (
              <Link
                key={c.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  active
                    ? "bg-ink text-white"
                    : "border-2 border-ink/15 bg-white text-ink hover:bg-ink/5"
                }`}
              >
                {c.label} <span className="font-mono text-xs">{c.count}</span>
              </Link>
            );
          })}
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {kindChips.map((c) => {
            const active = kindFilter === c.value;
            const href = buildMistakesHref({
              status: filter,
              kind: c.value,
            });
            return (
              <Link
                key={c.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm font-bold transition ${
                  active
                    ? "bg-ink text-white"
                    : "border-2 border-ink/15 bg-white text-ink hover:bg-ink/5"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {notes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-10 text-center text-sm text-ink/60">
            {filter === "ALL"
              ? "还没有错题记录。完成一次阅读练习后，错题会自动出现在这里。"
              : "该分组下暂无错题。"}
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => {
              const meta = STATUS_META[n.status];
              return (
                <li
                  key={n.id}
                  className="rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={meta.className}>{meta.label}</span>
                    {n.examPointId && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-xs font-bold text-ink/70">
                        {n.examPointId}
                      </span>
                    )}
                    {n.difficultyPointId && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-xs font-bold text-ink/70">
                        {n.difficultyPointId}
                      </span>
                    )}
                    <span className="text-xs text-ink/50">
                      {n.createdAt.toLocaleDateString("zh-CN")}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3">
                      <div className="text-xs font-bold text-red-600">
                        你的作答
                      </div>
                      <div className="mt-0.5 font-mono text-red-800">
                        {n.userAnswer.trim() || "（未作答）"}
                      </div>
                    </div>
                    <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3">
                      <div className="text-xs font-bold text-green-700">
                        正确答案
                      </div>
                      <div className="mt-0.5 font-mono text-green-800">
                        {n.correctAnswer}
                      </div>
                    </div>
                  </div>

                  {n.explanationZh && (
                    <div className="mt-3 rounded-xl bg-ink/5 p-3 text-sm">
                      <div className="text-xs font-bold text-ink/60">解析</div>
                      <div className="mt-0.5 leading-relaxed text-ink/85">
                        {n.explanationZh}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex justify-end">
                    <StatusButtons id={n.id} current={n.status} />
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
