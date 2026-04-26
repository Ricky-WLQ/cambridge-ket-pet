import { NextResponse } from "next/server";
import type { ExamType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WEAK_TOPIC_THRESHOLD = 0.6;
const WEAK_TOPIC_MIN_ATTEMPTS = 3;

function parseExamType(raw: string | null): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return userId;
}

export async function GET(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  const url = new URL(request.url);
  const examType = parseExamType(url.searchParams.get("examType"));
  if (!examType) {
    return NextResponse.json({ error: "examType is required" }, { status: 400 });
  }

  const rows = await prisma.grammarProgress.findMany({
    where: { userId, examType },
    select: { topicId: true, isCorrect: true },
  });

  const totalAttempted = rows.length;
  const totalCorrect = rows.filter((r) => r.isCorrect).length;
  const accuracy = totalAttempted === 0 ? 0 : totalCorrect / totalAttempted;

  const perTopicMap = new Map<string, { attempted: number; correct: number }>();
  for (const r of rows) {
    const cur = perTopicMap.get(r.topicId) ?? { attempted: 0, correct: 0 };
    cur.attempted++;
    if (r.isCorrect) cur.correct++;
    perTopicMap.set(r.topicId, cur);
  }
  const perTopic = Array.from(perTopicMap.entries()).map(([topicId, c]) => ({
    topicId,
    attempted: c.attempted,
    correct: c.correct,
    accuracy: c.attempted === 0 ? 0 : c.correct / c.attempted,
  }));

  const weakTopics = perTopic
    .filter((t) => t.attempted >= WEAK_TOPIC_MIN_ATTEMPTS && t.accuracy < WEAK_TOPIC_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((t) => t.topicId);

  return NextResponse.json({ totalAttempted, totalCorrect, accuracy, perTopic, weakTopics });
}

export async function POST(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  let body: {
    questionId?: string; examType?: string; topicId?: string;
    userAnswer?: number; isCorrect?: boolean;
    questionText?: string; questionOptions?: string[];
    correctIndex?: number; explanationZh?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const examType = parseExamType(body.examType ?? null);
  if (
    !body.questionId || !body.topicId || !examType ||
    typeof body.userAnswer !== "number" ||
    typeof body.isCorrect !== "boolean" ||
    typeof body.questionText !== "string" ||
    !Array.isArray(body.questionOptions) ||
    typeof body.correctIndex !== "number" ||
    typeof body.explanationZh !== "string"
  ) {
    return NextResponse.json({ error: "missing or invalid required fields" }, { status: 400 });
  }

  // Server-recompute isCorrect to prevent client-side stat corruption.
  const isCorrect = body.userAnswer === body.correctIndex;

  const existing = await prisma.grammarProgress.findUnique({
    where: { userId_questionId: { userId, questionId: body.questionId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ progress: existing });
  }

  const created = await prisma.grammarProgress.create({
    data: {
      userId,
      questionId: body.questionId,
      examType,
      topicId: body.topicId,
      userAnswer: body.userAnswer,
      isCorrect,
      questionText: body.questionText,
      questionOptions: body.questionOptions,
      correctIndex: body.correctIndex,
      explanationZh: body.explanationZh,
    },
  });

  return NextResponse.json({ progress: created });
}
