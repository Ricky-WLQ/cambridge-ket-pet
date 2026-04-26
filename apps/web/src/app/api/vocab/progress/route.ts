import { NextResponse } from "next/server";
import type { ExamType, Prisma, WordTier } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeNextReview, MASTERY_MASTERED_THRESHOLD } from "@/lib/vocab/srs";

const MAX_TAKE_GET = 500;
const MAX_DUE_LIMIT = 100;

function parseExamType(raw: string | null): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

function parseTier(raw: string | null): WordTier | undefined {
  if (raw === "CORE" || raw === "RECOMMENDED" || raw === "EXTRA") return raw;
  return undefined;
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
  const tier = parseTier(url.searchParams.get("tier"));

  const where: Prisma.VocabProgressWhereInput = { userId, examType };
  if (tier) where.wordRef = { tier };

  const rows = await prisma.vocabProgress.findMany({
    where,
    take: MAX_TAKE_GET,
    orderBy: { updatedAt: "desc" },
    select: {
      wordId: true, word: true, mastery: true, lastReviewed: true,
      nextReview: true, reviewCount: true, correctCount: true,
      wordRef: { select: { tier: true } },
    },
  });

  const stats = aggregateStats(rows);

  // Wordlist totals (denominators for the hub) — independent of user progress.
  const wordlistByTier = await prisma.word.groupBy({
    by: ["tier"],
    where: { examType, ...(tier ? { tier } : {}) },
    _count: { _all: true },
  });
  const wordlistTotals = {
    total: wordlistByTier.reduce((sum, g) => sum + g._count._all, 0),
    byTier: { CORE: 0, RECOMMENDED: 0, EXTRA: 0 } as Record<WordTier, number>,
  };
  for (const g of wordlistByTier) {
    wordlistTotals.byTier[g.tier as WordTier] = g._count._all;
  }

  return NextResponse.json({ progress: rows.map(stripWordRef), stats, wordlistTotals });
}

export async function POST(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  let body: {
    wordId?: string; examType?: string; isCorrect?: boolean;
    markMastered?: boolean; source?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const examType = parseExamType(body.examType ?? null);
  if (!body.wordId || !examType || typeof body.isCorrect !== "boolean") {
    return NextResponse.json(
      { error: "wordId, examType, and isCorrect are required" },
      { status: 400 },
    );
  }

  const word = await prisma.word.findUnique({
    where: { id: body.wordId },
    select: { id: true, word: true, examType: true },
  });
  if (!word || word.examType !== examType) {
    return NextResponse.json({ error: "Word not found for given examType" }, { status: 404 });
  }

  const existing = await prisma.vocabProgress.findUnique({
    where: { userId_wordId: { userId, wordId: body.wordId } },
    select: { mastery: true, reviewCount: true, correctCount: true },
  });

  const now = new Date();
  const next = computeNextReview({
    mastery: existing?.mastery ?? 0,
    isCorrect: body.isCorrect,
    markMastered: body.markMastered ?? false,
    now,
  });

  const reviewCount = (existing?.reviewCount ?? 0) + 1;
  const correctCount = (existing?.correctCount ?? 0) + (body.isCorrect ? 1 : 0);

  const upserted = await prisma.vocabProgress.upsert({
    where: { userId_wordId: { userId, wordId: body.wordId } },
    create: {
      userId,
      examType,
      wordId: body.wordId,
      word: word.word,
      mastery: next.mastery,
      lastReviewed: now,
      nextReview: next.nextReview,
      reviewCount,
      correctCount,
      source: body.source ?? null,
    },
    update: {
      mastery: next.mastery,
      lastReviewed: now,
      nextReview: next.nextReview,
      reviewCount,
      correctCount,
      source: body.source ?? undefined,
    },
  });

  return NextResponse.json({ progress: upserted });
}

export async function PUT(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  let body: { examType?: string; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const examType = parseExamType(body.examType ?? null);
  if (!examType) {
    return NextResponse.json({ error: "examType is required" }, { status: 400 });
  }
  const limit = Math.min(MAX_DUE_LIMIT, Math.max(1, body.limit ?? 20));
  const now = new Date();

  const dueWords = await prisma.vocabProgress.findMany({
    where: {
      userId,
      examType,
      nextReview: { lte: now },
    },
    take: limit,
    orderBy: { nextReview: "asc" },
    select: {
      wordId: true, word: true, mastery: true, lastReviewed: true,
      nextReview: true, reviewCount: true, correctCount: true,
    },
  });
  return NextResponse.json({ dueWords });
}

export async function DELETE(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  const url = new URL(request.url);
  const examType = parseExamType(url.searchParams.get("examType"));
  if (!examType) {
    return NextResponse.json({ error: "examType is required" }, { status: 400 });
  }
  const tier = parseTier(url.searchParams.get("tier"));

  const where: Prisma.VocabProgressWhereInput = { userId, examType };
  if (tier) where.wordRef = { tier };

  await prisma.vocabProgress.deleteMany({ where });
  return NextResponse.json({ success: true });
}

// ----- helpers -----

type RowWithTier = {
  wordId: string;
  word: string;
  mastery: number;
  lastReviewed: Date | null;
  nextReview: Date | null;
  reviewCount: number;
  correctCount: number;
  wordRef: { tier: WordTier } | null;
};

function aggregateStats(rows: RowWithTier[]) {
  const stats = {
    total: rows.length,
    mastered: 0,
    byTier: {
      CORE: { total: 0, mastered: 0 },
      RECOMMENDED: { total: 0, mastered: 0 },
      EXTRA: { total: 0, mastered: 0 },
    } as Record<WordTier, { total: number; mastered: number }>,
    byMastery: [0, 0, 0, 0, 0, 0],
  };
  for (const r of rows) {
    const isMastered = r.mastery >= MASTERY_MASTERED_THRESHOLD;
    if (isMastered) stats.mastered++;
    if (r.wordRef) {
      const t = r.wordRef.tier;
      stats.byTier[t].total++;
      if (isMastered) stats.byTier[t].mastered++;
    }
    if (r.mastery >= 0 && r.mastery <= 5) stats.byMastery[r.mastery]++;
  }
  return stats;
}

function stripWordRef(row: RowWithTier) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { wordRef, ...rest } = row;
  return rest;
}
