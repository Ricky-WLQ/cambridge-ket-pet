import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gradeReading } from "@/lib/grading";
import { gradeListening } from "@/lib/grading/listening";
import type { ListeningTestPayloadV2 } from "@/lib/audio/types";
import {
  gradeWriting,
  type ReadingQuestion,
  type WritingTaskType,
} from "@/lib/aiClient";

export const maxDuration = 150; // allow time for the writing grader (~30-90s)

const submitSchema = z.object({
  // Generic string map: keyed by question-id for READING / LISTENING, or by
  // { response, chosenOption? } for WRITING. Per-kind validation below.
  answers: z.record(z.string(), z.string()),
  // LISTENING only: client-initiated auto-submit on time-up; bypasses
  // server-side time-limit check so expired attempts still persist answers.
  forceSubmit: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "答案格式无效" }, { status: 400 });
  }

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

  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "未找到作答" }, { status: 404 });
  }
  if (attempt.status === "SUBMITTED" || attempt.status === "GRADED") {
    return NextResponse.json(
      { error: "本次作答已提交" },
      { status: 409 },
    );
  }

  // --------- READING: deterministic grader runs synchronously, status -> GRADED
  if (attempt.test.kind === "READING") {
    const payload = attempt.test.payload as unknown as {
      questions: ReadingQuestion[];
    };
    const result = gradeReading(payload.questions, parsed.data.answers);

    // Build MistakeNote rows for wrong answers (one per question that was
    // either wrong or blank).
    const mistakeNotesData = payload.questions
      .map((q, i) => ({ q, pq: result.perQuestion[i] }))
      .filter(({ pq }) => !pq.isCorrect)
      .map(({ q, pq }) => ({
        userId,
        attemptId,
        questionId: q.id,
        userAnswer: pq.userAnswer,
        correctAnswer: pq.correctAnswer,
        explanationZh: q.explanation_zh ?? null,
        examPointId: q.exam_point_id ?? null,
        difficultyPointId: q.difficulty_point_id ?? null,
      }));

    await prisma.$transaction(async (tx) => {
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: {
          status: "GRADED",
          submittedAt: new Date(),
          answers: parsed.data.answers,
          rawScore: result.rawScore,
          totalPossible: result.totalPossible,
          scaledScore: result.scaledScore,
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

    return NextResponse.json({
      attemptId,
      rawScore: result.rawScore,
      totalPossible: result.totalPossible,
      scaledScore: result.scaledScore,
    });
  }

  // --------- LISTENING: deterministic grader runs synchronously, status -> GRADED
  if (attempt.test.kind === "LISTENING") {
    // Server-side time-limit enforcement with grace period. `forceSubmit`
    // is set by the client when the countdown hits zero so the auto-submit
    // call still persists answers even past the grace window.
    const timeLimitMs =
      Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800) * 1000;
    const graceMs = Number(process.env.LISTENING_GRACE_PERIOD_MS ?? 60000);
    const elapsedMs = Date.now() - attempt.startedAt.getTime();
    const forceSubmit = parsed.data.forceSubmit === true;

    if (!forceSubmit && elapsedMs > timeLimitMs + graceMs) {
      return NextResponse.json(
        { error: "time_exceeded", message: "考试时间已结束，答案已自动提交" },
        { status: 400 },
      );
    }

    const payload = attempt.test.payload as unknown as ListeningTestPayloadV2;
    const result = gradeListening(payload.parts, parsed.data.answers);
    const scaledScore =
      result.totalPossible > 0
        ? Math.round((result.rawScore / result.totalPossible) * 100)
        : 0;

    // Build MistakeNote rows for wrong answers only. The grader's
    // ListeningQuestion already carries `explanationZh` so we can grab it
    // directly without a re-lookup.
    const questionIndex = new Map(
      payload.parts.flatMap((p) => p.questions).map((q) => [q.id, q]),
    );
    const wrongs = Object.values(result.perQuestion).filter((r) => !r.correct);
    const mistakeNotesData = wrongs.map((r) => ({
      userId,
      attemptId,
      questionId: r.questionId,
      userAnswer: r.userAnswer ?? "",
      correctAnswer: r.correctAnswer,
      explanationZh: questionIndex.get(r.questionId)?.explanationZh ?? null,
      examPointId: r.examPointId,
      difficultyPointId: r.difficultyPointId ?? null,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.testAttempt.update({
        where: { id: attemptId },
        data: {
          status: "GRADED",
          submittedAt: new Date(),
          answers: parsed.data.answers,
          rawScore: result.rawScore,
          totalPossible: result.totalPossible,
          scaledScore,
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

    return NextResponse.json({ attemptId, result, scaledScore });
  }

  // --------- WRITING: save response, then grade synchronously via AI, flip to GRADED
  if (attempt.test.kind === "WRITING") {
    const response = parsed.data.answers.response ?? "";
    if (!response.trim()) {
      return NextResponse.json({ error: "请先写下你的作文" }, { status: 400 });
    }

    // Save response first so if the grader fails we still have the submission.
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        answers: parsed.data.answers,
      },
    });

    const writingPayload = attempt.test.payload as unknown as {
      task_type: WritingTaskType;
      prompt: string;
      content_points: string[];
      scene_descriptions: string[];
    };
    const rawChosen = parsed.data.answers.chosenOption ?? null;
    const chosen_option: "A" | "B" | null =
      rawChosen === "A" || rawChosen === "B" ? rawChosen : null;

    let grade;
    try {
      grade = await gradeWriting({
        exam_type: attempt.test.examType,
        part: attempt.test.part ?? 0,
        prompt: writingPayload.prompt,
        content_points: writingPayload.content_points ?? [],
        scene_descriptions: writingPayload.scene_descriptions ?? [],
        chosen_option,
        student_response: response,
      });
    } catch (err) {
      console.error("Writing grader failed:", err);
      // Attempt stays at SUBMITTED; user can retry later via a re-grade flow (not in MVP).
      return NextResponse.json(
        {
          error: "批改服务暂时不可用，你的作文已保存，请稍后再试。",
          attemptId,
        },
        { status: 502 },
      );
    }

    const totalPossible = 20; // 4 criteria × 5 max
    const scaledScore = Math.round((grade.total_band / totalPossible) * 100);

    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "GRADED",
        rawScore: grade.total_band,
        totalPossible,
        scaledScore,
        weakPoints: {
          scores: grade.scores,
          feedback_zh: grade.feedback_zh,
          specific_suggestions_zh: grade.specific_suggestions_zh,
        },
      },
    });

    return NextResponse.json({
      attemptId,
      totalBand: grade.total_band,
      scaledScore,
    });
  }

  return NextResponse.json(
    { error: "当前题型暂不支持自动批改" },
    { status: 400 },
  );
}
