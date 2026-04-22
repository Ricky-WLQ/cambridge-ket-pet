import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redoAttemptAction } from "@/lib/attemptActions";

type WritingPayload = {
  prompt: string;
  content_points: string[];
  scene_descriptions: string[];
};

type StoredWritingResult = {
  scores: {
    content: number;
    communicative: number;
    organisation: number;
    language: number;
  };
  feedback_zh: string;
  specific_suggestions_zh: string[];
};

const CRITERIA: Array<{
  key: "content" | "communicative" | "organisation" | "language";
  labelZh: string;
  labelEn: string;
}> = [
  { key: "content", labelZh: "内容", labelEn: "Content" },
  { key: "communicative", labelZh: "沟通效果", labelEn: "Communicative" },
  { key: "organisation", labelZh: "结构", labelEn: "Organisation" },
  { key: "language", labelZh: "语言", labelEn: "Language" },
];

export default async function PetWritingResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        select: {
          examType: true,
          kind: true,
          part: true,
          payload: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.kind !== "WRITING") notFound();
  if (attempt.test.examType !== "PET") {
    redirect(`/ket/writing/result/${attemptId}`);
  }
  if (attempt.status !== "GRADED") {
    redirect(`/pet/writing/runner/${attemptId}`);
  }

  const payload = attempt.test.payload as unknown as WritingPayload;
  const stored = (attempt.weakPoints ?? {}) as unknown as StoredWritingResult;
  const userAnswers = (attempt.answers ?? {}) as Record<string, string>;
  const chosenOption =
    userAnswers.chosenOption === "A" || userAnswers.chosenOption === "B"
      ? (userAnswers.chosenOption as "A" | "B")
      : null;

  const totalBand = attempt.rawScore ?? 0;
  const scaledScore = attempt.scaledScore ?? 0;
  const colorClass =
    scaledScore >= 70
      ? "text-green-700"
      : scaledScore >= 50
        ? "text-amber-700"
        : "text-red-700";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">
          PET 写作 · Part {attempt.test.part} · 成绩
        </h1>
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <span>{attempt.mode === "MOCK" ? "模拟考试" : "练习模式"}</span>
          {chosenOption && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">
              你选择了：选项 {chosenOption}
            </span>
          )}
        </p>

        <div className="mt-6 rounded-md border border-neutral-300 p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            总分
          </div>
          <div className={`mt-1 text-4xl font-bold ${colorClass}`}>
            {totalBand}
            <span className="text-xl text-neutral-400"> / 20</span>
          </div>
          <div className="mt-1 text-lg text-neutral-600">{scaledScore}%</div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {CRITERIA.map((c) => (
            <div
              key={c.key}
              className="rounded-md border border-neutral-200 p-4 text-center"
            >
              <div className="text-xs text-neutral-500">{c.labelEn}</div>
              <div className="text-[11px] text-neutral-400">{c.labelZh}</div>
              <div className="mt-1 text-2xl font-bold">
                {stored.scores?.[c.key] ?? 0}
                <span className="text-sm text-neutral-400"> / 5</span>
              </div>
            </div>
          ))}
        </div>

        {stored.feedback_zh && (
          <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
            <div className="mb-2 text-sm font-medium text-blue-900">
              评语
            </div>
            <p className="whitespace-pre-wrap text-sm text-blue-900">
              {stored.feedback_zh}
            </p>
          </div>
        )}

        {stored.specific_suggestions_zh &&
          stored.specific_suggestions_zh.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="mb-2 text-sm font-medium text-amber-900">
                改进建议
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
                {stored.specific_suggestions_zh.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

        <div className="mt-8 rounded-md border border-neutral-200 p-4">
          <div className="mb-2 text-sm font-medium">题目</div>
          <div className="whitespace-pre-wrap text-sm text-neutral-700">
            {payload.prompt}
          </div>
          {payload.content_points?.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {payload.content_points.map((cp, i) => (
                <li key={i}>{cp}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-md border border-neutral-200 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">你的作文</span>
            {chosenOption && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">
                选项 {chosenOption}
              </span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
            {userAnswers.response ?? ""}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/history"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            ← 返回历史记录
          </Link>
          <div className="flex flex-wrap gap-2">
            <form action={redoAttemptAction}>
              <input type="hidden" name="attemptId" value={attempt.id} />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                再做一次
              </button>
            </form>
            <Link
              href="/pet"
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
            >
              返回 PET 门户
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
