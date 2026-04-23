import { prisma } from "@/lib/prisma";
import { gradeListening } from "@/lib/grading/listening";
import type { ListeningTestPayloadV2 } from "@/lib/audio/types";

/**
 * Force-submit IN_PROGRESS LISTENING attempts whose startedAt is older than
 * (timeLimit + grace). Grades them with whatever answers were persisted so
 * far, writes a GRADED TestAttempt + MistakeNote rows, and returns the number
 * of attempts force-submitted.
 *
 * Mirrors the grading flow in `app/api/tests/[attemptId]/submit/route.ts`
 * (Task 34) so force-submit produces the same shape as a normal submit.
 */
export async function forceSubmitExpired(now: Date = new Date()): Promise<number> {
  const timeLimitSec = Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800);
  const graceMs = Number(process.env.LISTENING_GRACE_PERIOD_MS ?? 60000);
  const cutoff = new Date(now.getTime() - (timeLimitSec * 1000 + graceMs));

  const expired = await prisma.testAttempt.findMany({
    where: {
      status: "IN_PROGRESS",
      startedAt: { lte: cutoff },
      test: { kind: "LISTENING" },
    },
    include: { test: true },
  });

  for (const attempt of expired) {
    const payload = attempt.test.payload as unknown as ListeningTestPayloadV2;
    const answers = (attempt.answers ?? {}) as Record<string, string>;
    const result = gradeListening(payload.parts, answers);

    const questionIndex = new Map(
      payload.parts.flatMap((p) => p.questions).map((q) => [q.id, q]),
    );
    const wrongs = Object.values(result.perQuestion).filter((r) => !r.correct);
    const mistakeNotesData = wrongs.map((r) => ({
      userId: attempt.userId,
      attemptId: attempt.id,
      questionId: r.questionId,
      userAnswer: r.userAnswer ?? "",
      correctAnswer: r.correctAnswer,
      explanationZh: questionIndex.get(r.questionId)?.explanationZh ?? null,
      examPointId: r.examPointId,
      difficultyPointId: r.difficultyPointId ?? null,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "GRADED",
          submittedAt: now,
          rawScore: result.rawScore,
          totalPossible: result.totalPossible,
          weakPoints: {
            examPoints: result.weakPoints.examPoints,
            difficultyPoints: result.weakPoints.difficultyPoints,
          },
        },
      });
      if (mistakeNotesData.length > 0) {
        await tx.mistakeNote.createMany({ data: mistakeNotesData });
      }
    });
  }

  return expired.length;
}
