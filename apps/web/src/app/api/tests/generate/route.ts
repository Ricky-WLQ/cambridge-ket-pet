import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndRecordGeneration } from "@/lib/rateLimit";
import { generateReadingTest } from "@/lib/aiClient";

const HOURLY_LIMIT = 20;

const requestSchema = z.object({
  examType: z.enum(["KET", "PET"]),
  part: z.number().int().min(1).max(7),
  mode: z.enum(["PRACTICE", "MOCK"]).default("PRACTICE"),
});

export async function POST(req: Request) {
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入无效", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { examType, part, mode } = parsed.data;

  const rate = await checkAndRecordGeneration(
    userId,
    "reading_generate",
    HOURLY_LIMIT,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `已达每小时生成上限（${rate.limit} 次）。请稍后再试。`,
        resetAt: rate.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  let aiResponse;
  try {
    aiResponse = await generateReadingTest({
      exam_type: examType,
      part,
      mode,
    });
  } catch (err) {
    console.error("AI service call failed:", err);
    return NextResponse.json(
      { error: "生成失败，请重试" },
      { status: 502 },
    );
  }

  const { test, attempt } = await prisma.$transaction(async (tx) => {
    const createdTest = await tx.test.create({
      data: {
        examType,
        kind: "READING",
        part,
        mode,
        difficulty: examType === "KET" ? "A2" : "B1",
        payload: aiResponse,
        timeLimitSec: aiResponse.time_limit_sec,
        generatedBy: "deepseek-chat",
      },
      select: { id: true },
    });
    const createdAttempt = await tx.testAttempt.create({
      data: {
        userId,
        testId: createdTest.id,
        status: "IN_PROGRESS",
        mode,
      },
      select: { id: true },
    });
    return { test: createdTest, attempt: createdAttempt };
  });

  return NextResponse.json(
    { attemptId: attempt.id, testId: test.id },
    { status: 201 },
  );
}
