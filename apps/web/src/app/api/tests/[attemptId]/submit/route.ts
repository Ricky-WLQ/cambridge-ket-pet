import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gradeReading, type GradableQuestion } from "@/lib/grading";

const submitSchema = z.object({
  // Generic string map: keyed by question-id for READING, or by
  // { response, chosenOption? } for WRITING. Per-kind validation below.
  answers: z.record(z.string(), z.string()),
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
      test: { select: { kind: true, payload: true } },
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
      questions: GradableQuestion[];
    };
    const result = gradeReading(payload.questions, parsed.data.answers);

    await prisma.testAttempt.update({
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

    return NextResponse.json({
      attemptId,
      rawScore: result.rawScore,
      totalPossible: result.totalPossible,
      scaledScore: result.scaledScore,
    });
  }

  // --------- WRITING: save response, flip to SUBMITTED; AI grader (Step 16) flips to GRADED later
  if (attempt.test.kind === "WRITING") {
    const response = parsed.data.answers.response ?? "";
    if (!response.trim()) {
      return NextResponse.json({ error: "请先写下你的作文" }, { status: 400 });
    }
    await prisma.testAttempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        answers: parsed.data.answers,
      },
    });
    return NextResponse.json({ attemptId, pending: "grading" });
  }

  return NextResponse.json(
    { error: "当前题型暂不支持自动批改" },
    { status: 400 },
  );
}
