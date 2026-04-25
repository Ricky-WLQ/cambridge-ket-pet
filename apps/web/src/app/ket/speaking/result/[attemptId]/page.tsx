import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/SiteHeader";
import { SpeakingResult } from "@/components/speaking/SpeakingResult";

export default async function KetSpeakingResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const { attemptId } = await params;
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { examType: true, kind: true } },
    },
  });
  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.examType !== "KET" || attempt.test.kind !== "SPEAKING") {
    notFound();
  }

  const transcript = (attempt.transcript as
    | { role: "user" | "assistant"; content: string; part: number }[]
    | null) ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <SpeakingResult
          attemptId={attempt.id}
          level="KET"
          initialTranscript={transcript}
          initialRubric={
            (attempt.rubricScores as Parameters<
              typeof SpeakingResult
            >[0]["initialRubric"]) ?? null
          }
          initialStatus={attempt.speakingStatus ?? "SUBMITTED"}
          initialError={attempt.speakingError}
          initialRawScore={attempt.rawScore ?? null}
          initialScaledScore={attempt.scaledScore ?? null}
          initialTotalPossible={attempt.totalPossible ?? null}
        />
      </main>
    </div>
  );
}
