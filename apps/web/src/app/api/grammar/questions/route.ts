import { NextResponse } from "next/server";
import type { ExamType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_COUNT = 50;
const DEFAULT_COUNT = 10;

function parseExamType(raw: string | null): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const examType = parseExamType(url.searchParams.get("examType"));
  if (!examType) {
    return NextResponse.json(
      { error: "examType query param is required (KET or PET)" },
      { status: 400 },
    );
  }

  const topicId = url.searchParams.get("topicId")?.trim() || null;
  const count = Math.min(
    MAX_COUNT,
    Math.max(1, parseInt(url.searchParams.get("count") ?? String(DEFAULT_COUNT), 10) || DEFAULT_COUNT),
  );

  const selectFields = {
    id: true, examType: true, topicId: true, questionType: true,
    question: true, options: true, correctIndex: true,
    explanationEn: true, explanationZh: true, difficulty: true,
  };

  if (topicId) {
    const all = await prisma.grammarQuestion.findMany({
      where: { examType, topicId },
      select: selectFields,
    });
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return NextResponse.json({
      questions: shuffled.slice(0, count),
      totalCount: all.length,
    });
  }

  const topics = await prisma.grammarTopic.findMany({
    where: { examType },
    select: { id: true },
  });
  const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);

  const PER_TOPIC_POOL = Math.max(2, Math.ceil(count / Math.max(1, topics.length / 2)));
  const pools: Array<Array<{ id: string; topicId: string; question: string; options: string[]; correctIndex: number; explanationEn: string | null; explanationZh: string; difficulty: number; questionType: string; examType: ExamType }>> = [];
  for (const t of shuffledTopics) {
    const all = await prisma.grammarQuestion.findMany({
      where: { examType, topicId: t.id },
      select: selectFields,
    });
    pools.push([...all].sort(() => Math.random() - 0.5).slice(0, PER_TOPIC_POOL));
  }

  const out: typeof pools[0] = [];
  let idx = 0;
  while (out.length < count) {
    let progressed = false;
    for (let i = 0; i < pools.length && out.length < count; i++) {
      const pool = pools[(i + idx) % pools.length];
      if (pool.length > 0) {
        out.push(pool.shift()!);
        progressed = true;
      }
    }
    if (!progressed) break;
    idx++;
  }

  return NextResponse.json({
    questions: out,
    totalCount: out.length,
  });
}
