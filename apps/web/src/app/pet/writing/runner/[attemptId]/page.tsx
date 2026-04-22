import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WritingRunner from "@/components/writing/Runner";
import type { WritingTaskType } from "@/lib/aiClient";

type WritingPayload = {
  task_type: WritingTaskType;
  prompt: string;
  content_points: string[];
  scene_descriptions: string[];
  min_words: number;
};

export default async function PetWritingRunnerPage({
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
          timeLimitSec: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.kind !== "WRITING") notFound();
  if (attempt.test.examType !== "PET") {
    redirect(`/ket/writing/runner/${attemptId}`);
  }
  if (attempt.status !== "IN_PROGRESS") {
    redirect("/pet");
  }

  const payload = attempt.test.payload as unknown as WritingPayload;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <WritingRunner
          attemptId={attempt.id}
          examType="PET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          taskType={payload.task_type}
          prompt={payload.prompt}
          contentPoints={payload.content_points ?? []}
          sceneDescriptions={payload.scene_descriptions ?? []}
          minWords={payload.min_words}
          timeLimitSec={attempt.test.timeLimitSec ?? 0}
        />
      </main>
    </div>
  );
}
