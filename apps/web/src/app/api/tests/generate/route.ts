import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndRecordGeneration } from "@/lib/rateLimit";
import { generateReadingTest } from "@/lib/aiClient";
import { audioSemaphore, QueueFullError } from "@/lib/audio/queue";
import {
  fetchListeningPayload,
  generateListeningAudio,
} from "@/lib/audio/generate";

const HOURLY_LIMIT = 20;

const readingSchema = z.object({
  kind: z.literal("READING").optional(),
  examType: z.enum(["KET", "PET"]),
  part: z.number().int().min(1).max(7),
  mode: z.enum(["PRACTICE", "MOCK"]).default("PRACTICE"),
});

const listeningSchema = z.object({
  kind: z.literal("LISTENING"),
  examType: z.enum(["KET", "PET"]),
  mode: z.enum(["PRACTICE", "MOCK"]),
  scope: z.enum(["FULL", "PART"]),
  part: z.number().int().min(1).max(5).optional(),
});

const requestSchema = z.union([listeningSchema, readingSchema]);

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

  // ============== LISTENING branch (Phase 2) ==============
  if (parsed.data.kind === "LISTENING") {
    const { examType, mode, scope, part } = parsed.data;

    if (scope === "PART" && part === undefined) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "scope=PART requires a part number",
        },
        { status: 400 },
      );
    }

    // Rate limit (counts both successful + failed generations since record
    // happens at check-time, before the background job runs).
    const listeningRateLimit = Number(
      process.env.LISTENING_RATE_LIMIT_PER_HOUR ?? 10,
    );
    const rate = await checkAndRecordGeneration(
      userId,
      "listening_generate",
      listeningRateLimit,
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

    // Acquire semaphore BEFORE creating Test row (avoid leaking rows on overflow)
    try {
      await audioSemaphore().acquire();
    } catch (err) {
      if (err instanceof QueueFullError) {
        return NextResponse.json(
          { error: "queue_full", message: "系统繁忙，请稍后再试" },
          { status: 503 },
        );
      }
      throw err;
    }

    const test = await prisma.test.create({
      data: {
        userId,
        examType,
        kind: "LISTENING",
        part: scope === "PART" ? part! : null,
        mode,
        difficulty: examType === "KET" ? "A2" : "B1",
        payload: {},
        generatedBy: "deepseek-chat",
        audioStatus: "GENERATING",
        audioGenStartedAt: new Date(),
      },
      select: { id: true },
    });

    // Fire-and-forget background job
    setImmediate(async () => {
      try {
        const payload = await fetchListeningPayload({
          examType,
          scope,
          part,
          mode,
        });
        const ratePercent = examType === "KET" ? -5 : 0;
        const { r2Key, segments } = await generateListeningAudio({
          testId: test.id,
          payload,
          ratePercent,
        });
        await prisma.test.update({
          where: { id: test.id },
          data: {
            payload: payload as unknown as object,
            audioStatus: "READY",
            audioR2Key: r2Key,
            audioSegments: segments as unknown as object,
            audioGenCompletedAt: new Date(),
          },
        });
      } catch (err) {
        console.error("Listening audio generation failed:", err);
        await prisma.test.update({
          where: { id: test.id },
          data: {
            audioStatus: "FAILED",
            audioErrorMessage:
              err instanceof Error ? err.message : String(err),
            audioGenCompletedAt: new Date(),
          },
        });
      } finally {
        audioSemaphore().release();
      }
    });

    return NextResponse.json({
      testId: test.id,
      audioStatus: "GENERATING",
    });
  }

  // ============== READING branch (Phase 1, unchanged) ==============
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
        userId,
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
