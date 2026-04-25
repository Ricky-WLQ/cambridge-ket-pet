import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appendTurn } from "@/lib/speaking/turn-buffer";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  currentPart: z.number().int().min(1).max(6),
  // How many examiner questions have already been issued in currentPart.
  // Used by the Python examiner agent as a deterministic script-progression
  // cursor so it doesn't cycle back to script[0] of an exhausted part.
  // Optional with sane default for backwards compat with any older client.
  currentPartQuestionCount: z.number().int().min(0).max(20).default(0),
});

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

const REPLY_TIMEOUT_MS = 10_000;
const FILLER_REPLY = "One moment — could you say that again?";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (attempt.speakingStatus !== "IN_PROGRESS") {
    return NextResponse.json(
      { error: "attempt not in progress" },
      { status: 409 },
    );
  }

  const test = await prisma.test.findUnique({
    where: { id: attempt.testId },
  });
  if (!test?.speakingPrompts) {
    return NextResponse.json({ error: "no prompts" }, { status: 500 });
  }

  const aiBase = process.env.INTERNAL_AI_URL;
  if (!aiBase) {
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 },
    );
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");

  try {
    const aiRes = await fetchWithTimeout(
      `${aiBase}/speaking/examiner`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.INTERNAL_AI_SHARED_SECRET ?? ""}`,
        },
        body: JSON.stringify({
          prompts: test.speakingPrompts,
          history: body.messages,
          current_part: body.currentPart,
          current_part_question_count: body.currentPartQuestionCount,
        }),
        cache: "no-store",
      },
      REPLY_TIMEOUT_MS,
    );
    if (!aiRes.ok) throw new Error(`AI HTTP ${aiRes.status}`);

    const parsed = (await aiRes.json()) as {
      reply: string;
      advancePart: number | null;
      sessionEnd: boolean;
    };

    if (lastUser) {
      appendTurn(attemptId, {
        userText: lastUser.content,
        replyText: parsed.reply,
        partNumber: body.currentPart,
        ts: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      reply: parsed.reply,
      flags: {
        advancePart: parsed.advancePart ?? null,
        sessionEnd: parsed.sessionEnd ?? false,
      },
    });
  } catch (err) {
    console.warn("[speaking/reply] upstream failure; returning filler", err);
    return NextResponse.json({
      reply: FILLER_REPLY,
      flags: { advancePart: null, sessionEnd: false, retry: true },
    });
  }
}
