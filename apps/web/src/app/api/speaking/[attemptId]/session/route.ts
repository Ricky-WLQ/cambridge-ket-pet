import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAkoolSession } from "@/lib/speaking/akool-client";
import { signR2PublicUrl } from "@/lib/r2-signed-url";

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function POST(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (attempt.speakingStatus !== "IDLE") {
    return NextResponse.json(
      { error: "session already in progress or finished" },
      { status: 409 },
    );
  }

  const test = await prisma.test.findUnique({
    where: { id: attempt.testId },
  });
  if (!test?.speakingPrompts) {
    return NextResponse.json(
      { error: "test has no speaking prompts" },
      { status: 500 },
    );
  }

  const avatarId = process.env.AKOOL_AVATAR_ID;
  if (!avatarId) {
    return NextResponse.json(
      { error: "AKOOL_AVATAR_ID not configured" },
      { status: 500 },
    );
  }

  const durationSeconds = Number(process.env.AKOOL_SESSION_DURATION_SEC ?? 900);
  const created = await createAkoolSession({
    avatarId,
    voiceId: process.env.AKOOL_VOICE_ID || null,
    durationSeconds,
    vadThreshold: Number(process.env.AKOOL_VAD_THRESHOLD ?? 0.6),
    // 2000ms (was 1500ms — and 500ms before that). K-12 ESL candidates
    // pause mid-sentence to think; 1500ms still cut some sentences in
    // half ("My favourite subject" / "is math") in QA. 2000ms covers
    // typical thinking pauses; pair this with the runner-side
    // debounce so any stragglers within ~600ms still merge into one
    // turn. The total max-pause budget before /reply fires is
    // ~2000+600 = 2.6s, which is acceptable Cambridge-pace.
    vadSilenceMs: Number(process.env.AKOOL_VAD_SILENCE_MS ?? 2000),
  });

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      speakingStatus: "IN_PROGRESS",
      akoolSessionId: created.akoolSessionId,
    },
  });

  // Build R2 photo proxy URLs. The /api/speaking/photos/[...key] route
  // auth-gates every request, so no time-limited presigning is needed.
  const photoUrls: Record<string, string> = {};
  for (const key of test.speakingPhotoKeys ?? []) {
    photoUrls[key] = signR2PublicUrl(key);
  }

  const prompts = test.speakingPrompts as {
    parts: unknown;
    initialGreeting: unknown;
  };

  return NextResponse.json({
    akoolSessionId: created.akoolSessionId,
    streamType: created.streamType,
    trtc: created.trtc,
    agora: created.agora,
    test: {
      parts: prompts.parts,
      initialGreeting: prompts.initialGreeting,
      photoUrls,
      level: test.speakingPersona,
    },
  });
}
