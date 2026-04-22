import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ReadingRunner, {
  type RunnerQuestion,
} from "@/components/reading/Runner";

type ReadingTestPayload = {
  passage: string | null;
  questions: Array<RunnerQuestion & { answer?: string }>;
  time_limit_sec: number;
};

export default async function PetReadingRunnerPage({
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
          payload: true,
          timeLimitSec: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.examType !== "PET") redirect(`/ket/reading/runner/${attemptId}`);

  if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
    redirect(`/pet/reading/result/${attemptId}`);
  }

  const payload = attempt.test.payload as unknown as ReadingTestPayload;
  const clientQuestions: RunnerQuestion[] = payload.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ReadingRunner
          attemptId={attempt.id}
          examType="PET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          passage={payload.passage}
          questions={clientQuestions}
          timeLimitSec={attempt.test.timeLimitSec ?? 0}
        />
      </main>
    </div>
  );
}
