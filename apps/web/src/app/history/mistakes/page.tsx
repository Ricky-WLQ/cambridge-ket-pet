import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StatusButtons from "./StatusButtons";

type Filter = "ALL" | "NEW" | "REVIEWED" | "MASTERED";

const STATUS_META: Record<
  "NEW" | "REVIEWED" | "MASTERED",
  { label: string; className: string }
> = {
  NEW: { label: "新错题", className: "bg-red-100 text-red-800" },
  REVIEWED: { label: "已复习", className: "bg-amber-100 text-amber-800" },
  MASTERED: { label: "已掌握", className: "bg-green-100 text-green-800" },
};

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter: Filter =
    status === "NEW" || status === "REVIEWED" || status === "MASTERED"
      ? status
      : "ALL";

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const notes = await prisma.mistakeNote.findMany({
    where: {
      userId,
      ...(filter === "ALL" ? {} : { status: filter }),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const counts = await prisma.mistakeNote.groupBy({
    by: ["status"],
    where: { userId },
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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">错题本</h1>
          <Link
            href="/history"
            className="flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
          >
            <span aria-hidden>←</span>
            <span>历史记录</span>
          </Link>
        </div>
        <p className="mb-6 text-sm text-neutral-500">
          阅读练习中答错的题目会自动汇总到这里。逐题复习后可标记为「已复习」，完全掌握后再标记为「已掌握」。
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = filter === c.value;
            const href = c.value === "ALL" ? "/history/mistakes" : `/history/mistakes?status=${c.value}`;
            return (
              <Link
                key={c.value}
                href={href}
                className={`rounded-full px-3 py-1 text-sm ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                }`}
              >
                {c.label} <span className="font-mono text-xs">{c.count}</span>
              </Link>
            );
          })}
        </div>

        {notes.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
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
                  className="rounded-md border border-neutral-200 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    {n.examPointId && (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-700">
                        {n.examPointId}
                      </span>
                    )}
                    {n.difficultyPointId && (
                      <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-mono text-xs text-neutral-700">
                        {n.difficultyPointId}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">
                      {n.createdAt.toLocaleDateString("zh-CN")}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <div className="text-xs text-red-600">你的作答</div>
                      <div className="mt-0.5 font-mono text-red-800">
                        {n.userAnswer.trim() || "（未作答）"}
                      </div>
                    </div>
                    <div className="rounded-md border border-green-200 bg-green-50 p-3">
                      <div className="text-xs text-green-700">正确答案</div>
                      <div className="mt-0.5 font-mono text-green-800">
                        {n.correctAnswer}
                      </div>
                    </div>
                  </div>

                  {n.explanationZh && (
                    <div className="mt-3 rounded-md bg-neutral-50 p-3 text-sm">
                      <div className="text-xs text-neutral-500">解析</div>
                      <div className="mt-0.5 leading-relaxed text-neutral-800">
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
