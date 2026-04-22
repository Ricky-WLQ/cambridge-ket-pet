import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { SiteHeader } from "@/components/SiteHeader";
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
  IN_PROGRESS: { label: "进行中", className: "bg-amber-100 text-amber-800" },
  SUBMITTED: { label: "已提交", className: "bg-blue-100 text-blue-800" },
  GRADED: { label: "已批改", className: "bg-green-100 text-green-800" },
  ABANDONED: { label: "已放弃", className: "bg-neutral-100 text-neutral-600" },
};

function runnerUrl(row: AttemptRow): string {
  const portal = row.test.examType === "KET" ? "ket" : "pet";
  const kindPath = row.test.kind === "WRITING" ? "writing" : "reading";
  return `/${portal}/${kindPath}/runner/${row.id}`;
}

function resultUrl(row: AttemptRow): string {
  const portal = row.test.examType === "KET" ? "ket" : "pet";
  const kindPath = row.test.kind === "WRITING" ? "writing" : "reading";
  return `/${portal}/${kindPath}/result/${row.id}`;
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

  const where: Prisma.TestAttemptWhereInput = { userId };
  if (sp.status && (STATUS_VALUES as readonly string[]).includes(sp.status)) {
    where.status = sp.status as (typeof STATUS_VALUES)[number];
  }
  if (sp.mode && (MODE_VALUES as readonly string[]).includes(sp.mode)) {
    where.mode = sp.mode as (typeof MODE_VALUES)[number];
  }
  const testFilter: Prisma.TestWhereInput = {};
  if (sp.examType && (EXAM_VALUES as readonly string[]).includes(sp.examType)) {
    testFilter.examType = sp.examType as (typeof EXAM_VALUES)[number];
  }
  if (sp.kind && (KIND_VALUES as readonly string[]).includes(sp.kind)) {
    testFilter.kind = sp.kind as (typeof KIND_VALUES)[number];
  }
  if (Object.keys(testFilter).length > 0) {
    where.test = testFilter;
  }

  const [attempts, mistakeCount] = await Promise.all([
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
  ]);

  const filteredCount = attempts.length;
  const hasAnyFilter = !!(sp.examType || sp.kind || sp.mode || sp.status);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">历史记录</h1>
          <Link
            href="/history/mistakes"
            className="flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-600"
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
        <p className="mb-4 text-sm text-neutral-500">
          你所有的练习和模拟考试，最多展示 100 条。使用下方筛选缩小范围。
        </p>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">快速跳转：</span>
          <Link
            href="/ket"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            KET 门户
          </Link>
          <Link
            href="/pet"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            PET 门户
          </Link>
        </div>

        <FiltersBar />

        {hasAnyFilter && (
          <p className="mb-4 text-xs text-neutral-500">
            当前筛选共 {filteredCount} 条记录
          </p>
        )}

        {attempts.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center">
            <p className="text-sm text-neutral-500">
              {hasAnyFilter
                ? "当前筛选下没有记录。"
                : "还没有任何答卷。"}
            </p>
            {!hasAnyFilter && (
              <div className="mt-4 flex justify-center gap-2">
                <Link
                  href="/ket"
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
                >
                  去 KET
                </Link>
                <Link
                  href="/pet"
                  className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
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
              const scoreText =
                a.rawScore !== null &&
                a.totalPossible !== null &&
                a.scaledScore !== null
                  ? `${a.rawScore}/${a.totalPossible} · ${a.scaledScore}%`
                  : null;

              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {a.test.examType} {kind} · Part {part}
                      </span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {MODE_ZH[a.mode]}
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
                    <div className="mt-1 text-xs text-neutral-500">
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
                        className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
                      >
                        继续作答
                      </Link>
                    )}
                    {(a.status === "GRADED" || a.status === "SUBMITTED") && (
                      <>
                        <Link
                          href={resultUrl(a)}
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
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
                            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700"
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
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
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
