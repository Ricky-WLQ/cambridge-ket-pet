import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import ResultView, {
  type ResultViewProps,
} from "@/components/reading/ResultView";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redoAttemptAction } from "@/lib/attemptActions";
import type { GradableQuestionType } from "@/lib/grading";

type ReadingTestPayload = {
  passage: string | null;
  questions: Array<{
    id: string;
    type: GradableQuestionType;
    prompt: string;
    options: string[] | null;
    answer: string;
    explanation_zh: string;
    exam_point_id: string;
    difficulty_point_id: string | null;
  }>;
  time_limit_sec: number;
};

type StoredWeakPoints = {
  examPoints: Array<{ id: string; errorCount: number }>;
  difficultyPoints: Array<{ id: string; errorCount: number }>;
};

export default async function KetReadingResultPage({
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
          part: true,
          mode: true,
          payload: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.examType !== "KET") {
    redirect(`/pet/reading/result/${attemptId}`);
  }
  if (attempt.status !== "GRADED") {
    // In Phase 1 we grade synchronously on submit, so an ungraded attempt
    // means the user landed here before submitting (refresh/bookmark).
    redirect(`/ket/reading/runner/${attemptId}`);
  }

  const payload = (attempt.test.payload ?? {}) as Partial<ReadingTestPayload>;
  const questions = payload.questions ?? [];
  const passage = payload.passage ?? null;
  // Older attempts (or attempts where the grading pipeline didn't write
  // weak-point arrays) can have `weakPoints` as `{}` or missing keys —
  // truthy enough to skip a `??` fallback but not array-shaped. Default
  // each field independently.
  const stored = (attempt.weakPoints ?? {}) as Partial<StoredWeakPoints>;
  const storedExam = stored.examPoints ?? [];
  const storedDifficulty = stored.difficultyPoints ?? [];

  const [examPoints, difficultyPoints] = await Promise.all([
    prisma.examPoint.findMany({
      where: { id: { in: storedExam.map((e) => e.id) } },
      select: { id: true, label: true, descriptionZh: true },
    }),
    prisma.difficultyPoint.findMany({
      where: { id: { in: storedDifficulty.map((d) => d.id) } },
      select: { id: true, label: true, descriptionZh: true },
    }),
  ]);

  const weakPoints: ResultViewProps["weakPoints"] = {
    examPoints: storedExam.map((wp) => {
      const ep = examPoints.find((e) => e.id === wp.id);
      return {
        id: wp.id,
        errorCount: wp.errorCount,
        label: ep?.label ?? wp.id,
        descriptionZh: ep?.descriptionZh ?? "",
      };
    }),
    difficultyPoints: storedDifficulty.map((wp) => {
      const dp = difficultyPoints.find((d) => d.id === wp.id);
      return {
        id: wp.id,
        errorCount: wp.errorCount,
        label: dp?.label ?? wp.id,
        descriptionZh: dp?.descriptionZh ?? "",
      };
    }),
  };

  const userAnswers = (attempt.answers ?? {}) as Record<string, string>;

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <ResultView
          examType="KET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          rawScore={attempt.rawScore ?? 0}
          totalPossible={attempt.totalPossible ?? questions.length}
          scaledScore={attempt.scaledScore ?? 0}
          userAnswers={userAnswers}
          passage={passage}
          questions={questions}
          weakPoints={weakPoints}
        />
        <div className="mx-auto flex max-w-3xl w-full flex-wrap items-center justify-between gap-3 px-1">
          <Link
            href="/history"
            className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
          >
            ← 返回历史记录
          </Link>
          <div className="flex flex-wrap gap-2">
            <form action={redoAttemptAction}>
              <input type="hidden" name="attemptId" value={attempt.id} />
              <button
                type="submit"
                className="rounded-full bg-ink text-white px-4 py-2 text-sm font-extrabold hover:bg-ink/90 transition"
              >
                再做一次
              </button>
            </form>
            <Link
              href="/ket"
              className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
            >
              返回 KET 门户
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
