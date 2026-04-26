import { NextResponse } from "next/server";
import type { ExamType, NoteStatus, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parseExamType(raw: string | null): ExamType | null {
  if (raw === "KET" || raw === "PET") return raw;
  return null;
}

function parseStatus(raw: string | null): NoteStatus | undefined {
  if (raw === "NEW" || raw === "REVIEWED" || raw === "MASTERED") return raw;
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
  const status = parseStatus(url.searchParams.get("status"));
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );

  // Mistakes = wrong answers. (User can also include correct-but-bookmarked later;
  // for MVP only show wrong answers.)
  const where: Prisma.GrammarProgressWhereInput = {
    userId,
    examType,
    isCorrect: false,
  };
  if (status) where.status = status;

  const [data, totalForFilter, statusGroups] = await Promise.all([
    prisma.grammarProgress.findMany({
      where,
      select: {
        id: true, topicId: true, questionText: true, questionOptions: true,
        correctIndex: true, userAnswer: true, explanationZh: true,
        status: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.grammarProgress.count({ where }),
    prisma.grammarProgress.groupBy({
      by: ["status"],
      where: { userId, examType, isCorrect: false },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<NoteStatus | "total", number> = { NEW: 0, REVIEWED: 0, MASTERED: 0, total: 0 };
  for (const g of statusGroups) {
    counts[g.status as NoteStatus] = g._count._all;
    counts.total += g._count._all;
  }

  // Group current page's data by topic for the UI.
  const byTopic: Record<string, typeof data> = {};
  for (const m of data) {
    if (!byTopic[m.topicId]) byTopic[m.topicId] = [];
    byTopic[m.topicId].push(m);
  }

  return NextResponse.json({
    data,
    grouped: { byTopic },
    counts,
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(totalForFilter / pageSize)),
    },
  });
}

export async function PUT(request: Request) {
  const userIdOrErr = await requireUserId();
  if (userIdOrErr instanceof NextResponse) return userIdOrErr;
  const userId = userIdOrErr;

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  const status = parseStatus(body.status ?? null);
  if (!status) {
    return NextResponse.json({ error: "status must be NEW, REVIEWED, or MASTERED" }, { status: 400 });
  }

  const updated = await prisma.grammarProgress.update({
    where: { id: body.id, userId },
    data: { status, reviewedAt: new Date() },
  });
  return NextResponse.json({ progress: updated });
}
