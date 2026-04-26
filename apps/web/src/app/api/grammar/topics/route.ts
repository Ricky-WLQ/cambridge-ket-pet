import { NextResponse } from "next/server";
import type { ExamType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const topics = await prisma.grammarTopic.findMany({
    where: { examType },
    select: {
      id: true, examType: true, category: true, topicId: true,
      labelEn: true, labelZh: true, spec: true, description: true,
      examples: true, murphyUnits: true,
    },
    orderBy: [{ category: "asc" }, { topicId: "asc" }],
  });

  const byCategory: Record<string, typeof topics> = {};
  for (const t of topics) {
    if (!byCategory[t.category]) byCategory[t.category] = [];
    byCategory[t.category].push(t);
  }

  return NextResponse.json({ topics, byCategory });
}
