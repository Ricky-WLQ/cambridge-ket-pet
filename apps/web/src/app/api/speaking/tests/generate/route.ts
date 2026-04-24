import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndRecordGeneration } from "@/lib/rateLimit";
import {
  pickPhotoKeys,
  PHOTO_LIBRARY_MANIFEST,
} from "@/lib/speaking/photo-library";

const bodySchema = z.object({
  level: z.enum(["KET", "PET"]),
  sourceTestId: z.string().optional(),
});

type SpeakingPromptsPayload = {
  level: "KET" | "PET";
  initialGreeting: string;
  parts: Array<{
    partNumber: number;
    title: string;
    targetMinutes: number;
    examinerScript: string[];
    coachingHints: string;
    photoKey: string | null;
  }>;
};

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const rate = await checkAndRecordGeneration(userId, "SPEAKING_ATTEMPT", 3);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "rate limit",
        resetAt: rate.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  const photoCount = body.level === "KET" ? 1 : 2;
  const photoKeys = pickPhotoKeys({
    level: body.level,
    count: photoCount,
  });
  const photoBriefs = photoKeys.map((key) => ({
    key,
    description:
      PHOTO_LIBRARY_MANIFEST.find((p) => p.key === key)?.description ?? "",
  }));

  const aiBase = process.env.INTERNAL_AI_URL;
  if (!aiBase) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 },
    );
  }
  const genRes = await fetch(`${aiBase}/speaking/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_AI_SHARED_SECRET ?? ""}`,
    },
    body: JSON.stringify({ level: body.level, photo_briefs: photoBriefs }),
    cache: "no-store",
  });
  if (!genRes.ok) {
    return NextResponse.json(
      { error: "generate failed", detail: `AI HTTP ${genRes.status}` },
      { status: 502 },
    );
  }
  const speakingPrompts = (await genRes.json()) as SpeakingPromptsPayload;

  const test = await prisma.test.create({
    data: {
      userId,
      examType: body.level,
      kind: "SPEAKING",
      mode: "PRACTICE",
      difficulty: body.level === "KET" ? "A2" : "B1",
      payload: {},
      generatedBy: "deepseek-chat",
      timeLimitSec: null,
      speakingPrompts,
      speakingPhotoKeys: speakingPrompts.parts
        .map((p) => p.photoKey)
        .filter((k): k is string => !!k),
      speakingPersona: body.level,
    },
  });

  const attempt = await prisma.testAttempt.create({
    data: {
      userId,
      testId: test.id,
      mode: "PRACTICE",
      speakingStatus: "IDLE",
    },
  });

  return NextResponse.json({ attemptId: attempt.id });
}
