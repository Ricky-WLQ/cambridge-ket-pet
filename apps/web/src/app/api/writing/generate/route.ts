import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndRecordGeneration } from "@/lib/rateLimit";
import { generateWritingTest } from "@/lib/aiClient";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

const HOURLY_LIMIT = 20;

// Cambridge-official per-part time budgets (seconds). Derived Next.js-side
// so the LLM doesn't need to emit this (and can't drift from the spec).
const TIME_LIMIT_SEC: Record<string, number> = {
  "KET.6": 600, // 10 min guided email
  "KET.7": 480, //  8 min picture story
  "PET.1": 1500, // 25 min email reply
  "PET.2": 1200, // 20 min letter or story
};

const requestSchema = z.object({
  examType: z.enum(["KET", "PET"]),
  part: z.number().int().min(1).max(7),
  mode: z.enum(["PRACTICE", "MOCK"]).default("PRACTICE"),
});

function validExamTypePart(examType: "KET" | "PET", part: number): boolean {
  if (examType === "KET") return part === 6 || part === 7;
  return part === 1 || part === 2;
}

export async function POST(req: Request) {
  const portal = derivePortalFromRequest(req);
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "输入无效", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { examType, part, mode } = parsed.data;

  if (!validExamTypePart(examType, part)) {
    return NextResponse.json(
      {
        error:
          examType === "KET"
            ? "KET 写作仅包含 Part 6 和 Part 7"
            : "PET 写作仅包含 Part 1 和 Part 2",
      },
      { status: 400 },
    );
  }

  const rate = await checkAndRecordGeneration(
    userId,
    "writing_generate",
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
    aiResponse = await generateWritingTest({
      exam_type: examType,
      part,
    });
  } catch (err) {
    console.error("AI service (writing) call failed:", err);
    return NextResponse.json(
      { error: "生成失败，请重试" },
      { status: 502 },
    );
  }

  const timeLimitSec = TIME_LIMIT_SEC[`${examType}.${part}`] ?? 0;

  const { test, attempt } = await prisma.$transaction(async (tx) => {
    const createdTest = await tx.test.create({
      data: {
        userId,
        examType,
        kind: "WRITING",
        part,
        mode,
        difficulty: examType === "KET" ? "A2" : "B1",
        payload: aiResponse,
        timeLimitSec,
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
