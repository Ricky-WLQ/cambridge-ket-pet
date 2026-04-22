import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import ResultView, {
  type ResultViewProps,
} from "@/components/reading/ResultView";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export default async function PetReadingResultPage({
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
  if (attempt.test.examType !== "PET") {
    redirect(`/ket/reading/result/${attemptId}`);
  }
  if (attempt.status !== "GRADED") {
    redirect(`/pet/reading/runner/${attemptId}`);
  }

  const payload = attempt.test.payload as unknown as ReadingTestPayload;
  const storedWeakPoints = (attempt.weakPoints ?? {
    examPoints: [],
    difficultyPoints: [],
  }) as unknown as StoredWeakPoints;

  const [examPoints, difficultyPoints] = await Promise.all([
    prisma.examPoint.findMany({
      where: { id: { in: storedWeakPoints.examPoints.map((e) => e.id) } },
      select: { id: true, label: true, descriptionZh: true },
    }),
    prisma.difficultyPoint.findMany({
      where: {
        id: { in: storedWeakPoints.difficultyPoints.map((d) => d.id) },
      },
      select: { id: true, label: true, descriptionZh: true },
    }),
  ]);

  const weakPoints: ResultViewProps["weakPoints"] = {
    examPoints: storedWeakPoints.examPoints.map((wp) => {
      const ep = examPoints.find((e) => e.id === wp.id);
      return {
        id: wp.id,
        errorCount: wp.errorCount,
        label: ep?.label ?? wp.id,
        descriptionZh: ep?.descriptionZh ?? "",
      };
    }),
    difficultyPoints: storedWeakPoints.difficultyPoints.map((wp) => {
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
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ResultView
          examType="PET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          rawScore={attempt.rawScore ?? 0}
          totalPossible={attempt.totalPossible ?? payload.questions.length}
          scaledScore={attempt.scaledScore ?? 0}
          userAnswers={userAnswers}
          passage={payload.passage}
          questions={payload.questions}
          weakPoints={weakPoints}
        />
      </main>
    </div>
  );
}
