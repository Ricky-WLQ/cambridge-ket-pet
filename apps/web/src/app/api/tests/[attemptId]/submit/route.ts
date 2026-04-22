import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const submitSchema = z.object({
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
    select: { id: true, userId: true, status: true },
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

  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      answers: parsed.data.answers,
    },
  });

  // Grading lands in Step 12; for now we just redirect to the result page
  // which will show a "grading pending" view until the grader is built.
  return NextResponse.json({ attemptId });
}
