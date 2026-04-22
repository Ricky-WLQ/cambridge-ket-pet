import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    kind: "READING" | "WRITING" | "LISTENING" | "SPEAKING" | "MOCK_FULL" | "MOCK_SECTION";
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
    className: "bg-amber-100 text-amber-800",
  },
  SUBMITTED: {
    label: "已提交",
    className: "bg-blue-100 text-blue-800",
  },
  GRADED: {
    label: "已批改",
    className: "bg-green-100 text-green-800",
  },
  ABANDONED: {
    label: "已放弃",
    className: "bg-neutral-100 text-neutral-600",
  },
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

async function redoAttempt(formData: FormData) {
  "use server";
  const attemptId = formData.get("attemptId");
  if (typeof attemptId !== "string") return;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const oldAttempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { id: true, examType: true, kind: true } },
    },
  });
  if (!oldAttempt || oldAttempt.userId !== userId) {
    redirect("/history");
  }

  const newAttempt = await prisma.testAttempt.create({
    data: {
      userId,
      testId: oldAttempt.testId,
      mode: oldAttempt.mode,
      status: "IN_PROGRESS",
    },
    select: { id: true },
  });

  revalidatePath("/history");
  const portal = oldAttempt.test.examType === "KET" ? "ket" : "pet";
  const kindPath = oldAttempt.test.kind === "WRITING" ? "writing" : "reading";
  redirect(`/${portal}/${kindPath}/runner/${newAttempt.id}`);
}

export default async function HistoryPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const attempts = (await prisma.testAttempt.findMany({
    where: { userId },
    include: {
      test: {
        select: {
          id: true,
          examType: true,
          kind: true,
          part: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  })) as AttemptRow[];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">历史记录</h1>
        <p className="mb-6 text-sm text-neutral-500">
          你所有的练习和模拟考试，最近 100 条
        </p>

        {attempts.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center">
            <p className="text-sm text-neutral-500">还没有任何答卷。</p>
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
                        <>
                          {" "}
                          · 提交于 {formatDate(a.submittedAt)}
                        </>
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
                        <form action={redoAttempt}>
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
                      <form action={redoAttempt}>
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
