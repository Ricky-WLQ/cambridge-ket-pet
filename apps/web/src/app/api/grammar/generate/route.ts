import { NextResponse } from "next/server";
import type { ExamType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/grammar/rate-limit";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_COUNT = 30;

const AI_URL = process.env.INTERNAL_AI_URL || "http://localhost:8001";
const SECRET = process.env.INTERNAL_AI_SHARED_SECRET || "";

function parseExamType(raw: unknown): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

interface AiMCQ {
  question: string;
  options: string[];
  correct_index: number;
  explanation_en?: string | null;
  explanation_zh: string;
  difficulty: number;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`grammar-generate:${userId}`, { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: `Too many requests. Try again in ${Math.ceil(rl.retryInMs / 1000)}s.` },
      { status: 429, headers: { "retry-after": String(Math.ceil(rl.retryInMs / 1000)) } },
    );
  }

  let body: { examType?: string; topicId?: string; count?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const examType = parseExamType(body.examType);
  if (!examType || !body.topicId || typeof body.count !== "number" || body.count < 1) {
    return NextResponse.json({ error: "examType, topicId, count are required" }, { status: 400 });
  }
  const count = Math.min(MAX_COUNT, Math.max(1, body.count));

  const topic = await prisma.grammarTopic.findUnique({
    where: { id: body.topicId },
    select: { id: true, examType: true, topicId: true, spec: true, examples: true },
  });
  if (!topic || topic.examType !== examType) {
    return NextResponse.json({ error: "topic not found for given examType" }, { status: 404 });
  }

  const existingRows = await prisma.grammarQuestion.findMany({
    where: { examType, topicId: topic.id },
    select: { question: true },
  });
  const existing = existingRows.map((r) => r.question);

  const aiRes = await fetch(`${AI_URL}/grammar-generate`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({
      examType,
      topicId: topic.topicId,
      spec: topic.spec,
      examples: topic.examples,
      existingQuestions: existing,
      count,
    }),
  });
  if (!aiRes.ok) {
    const aiBody = await aiRes.text();
    return NextResponse.json(
      { error: "ai_service_error", status: aiRes.status, body: aiBody.slice(0, 500), source: "fallback" },
      { status: 502 },
    );
  }
  const aiJson = (await aiRes.json()) as { questions: AiMCQ[] };

  const today = new Date().toISOString().slice(0, 10);
  await prisma.grammarQuestion.createMany({
    data: aiJson.questions.map((q) => ({
      examType,
      topicId: topic.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      explanationEn: q.explanation_en ?? null,
      explanationZh: q.explanation_zh,
      difficulty: q.difficulty,
      source: `ai:deepseek:${today}`,
    })),
  });

  return NextResponse.json({ questions: aiJson.questions, source: "ai" });
}
