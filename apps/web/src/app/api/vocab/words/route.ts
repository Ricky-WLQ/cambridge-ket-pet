import { NextResponse } from "next/server";
import type { ExamType, Prisma, WordTier } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

function parseExamType(raw: string | null): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

function parseTier(raw: string | null): WordTier | undefined {
  if (raw === "CORE" || raw === "RECOMMENDED" || raw === "EXTRA") return raw;
  return undefined;
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

  const tier = parseTier(url.searchParams.get("tier"));
  const topic = url.searchParams.get("topic")?.trim() || undefined;
  const search = url.searchParams.get("search")?.trim() || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );

  const where: Prisma.WordWhereInput = { examType };
  if (tier) where.tier = tier;
  if (topic) where.topics = { has: topic };
  if (search) {
    where.OR = [
      { word: { contains: search, mode: "insensitive" } },
      { glossZh: { contains: search, mode: "insensitive" } },
    ];
  }

  const [words, totalCount] = await Promise.all([
    prisma.word.findMany({
      where,
      select: {
        id: true, examType: true, cambridgeId: true, word: true, pos: true,
        phonetic: true, glossEn: true, glossZh: true, example: true,
        topics: true, tier: true, audioKey: true,
      },
      orderBy: { word: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.word.count({ where }),
  ]);

  return NextResponse.json({
    words,
    totalCount,
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    },
  });
}
