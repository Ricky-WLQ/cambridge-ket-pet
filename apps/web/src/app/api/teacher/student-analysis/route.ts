import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeStudent,
  type StudentAnalysisRequest,
} from "@/lib/aiClient";
import { checkAndRecordGeneration } from "@/lib/rateLimit";

export const maxDuration = 120;

const BodySchema = z.object({
  classId: z.string().min(1),
  studentId: z.string().min(1),
  focusExamType: z.enum(["KET", "PET"]).nullable().optional(),
});

type WritingStored = {
  scores?: {
    content?: number;
    communicative?: number;
    organisation?: number;
    language?: number;
  };
  feedback_zh?: string;
};

type WritingPayload = {
  prompt?: string;
  options?: Array<{ label: string; prompt: string }>;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }
  const { classId, studentId, focusExamType } = parsed.data;

  // Authorize: teacher owns the class, student is a member
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true },
  });
  if (!cls || cls.teacherId !== userId) {
    return NextResponse.json({ error: "班级不存在或无权访问" }, { status: 404 });
  }
  const membership = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId: studentId } },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "学生不在该班级中" }, { status: 404 });
  }

  // Rate limit per teacher (not per student) so one teacher can't spam.
  const rl = await checkAndRecordGeneration(userId, "analysis", 10);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `AI 分析调用次数已达上限（${rl.limit}/小时）。请稍后再试。`,
      },
      { status: 429 },
    );
  }

  // Gather the data the agent needs
  const [attempts, mistakesByExamPoint] = await Promise.all([
    prisma.testAttempt.findMany({
      where: {
        userId: studentId,
        ...(focusExamType ? { test: { examType: focusExamType } } : {}),
      },
      include: {
        test: {
          select: {
            examType: true,
            kind: true,
            part: true,
            payload: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 25,
    }),
    prisma.mistakeNote.groupBy({
      by: ["examPointId"],
      where: { userId: studentId, examPointId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const graded = attempts.filter((a) => a.status === "GRADED");
  const gradedScores = graded
    .map((a) => a.scaledScore)
    .filter((x): x is number => x !== null);

  const stats = {
    total_graded: graded.length,
    avg_score: gradedScores.length
      ? Math.round(
          gradedScores.reduce((s, x) => s + x, 0) / gradedScores.length,
        )
      : null,
    best_score: gradedScores.length ? Math.max(...gradedScores) : null,
    worst_score: gradedScores.length ? Math.min(...gradedScores) : null,
  };

  const recent_attempts = graded
    .slice(0, 15)
    .map((a) => ({
      date: a.startedAt.toISOString(),
      exam_type: a.test.examType,
      kind: a.test.kind,
      part: a.test.part,
      mode: a.mode,
      score: a.scaledScore ?? 0,
    }));

  // Writing averages
  const writingAttempts = graded.filter((a) => a.test.kind === "WRITING");
  let writing_averages: StudentAnalysisRequest["writing_averages"] = null;
  if (writingAttempts.length > 0) {
    const sums = { content: 0, communicative: 0, organisation: 0, language: 0 };
    let n = 0;
    for (const a of writingAttempts) {
      const s = (a.weakPoints as WritingStored | null)?.scores;
      if (!s) continue;
      sums.content += s.content ?? 0;
      sums.communicative += s.communicative ?? 0;
      sums.organisation += s.organisation ?? 0;
      sums.language += s.language ?? 0;
      n += 1;
    }
    if (n > 0) {
      writing_averages = {
        content: Math.round((sums.content / n) * 10) / 10,
        communicative: Math.round((sums.communicative / n) * 10) / 10,
        organisation: Math.round((sums.organisation / n) * 10) / 10,
        language: Math.round((sums.language / n) * 10) / 10,
        count: n,
      };
    }
  }

  // Top error exam points (enrich labels)
  const topErrors = [...mistakesByExamPoint]
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 6);
  const epIds = topErrors
    .map((t) => t.examPointId)
    .filter((x): x is string => x !== null);
  const epLabels = await prisma.examPoint.findMany({
    where: { id: { in: epIds } },
    select: { id: true, label: true, descriptionZh: true },
  });
  const epMap = new Map(epLabels.map((e) => [e.id, e]));
  const top_error_exam_points = topErrors.map((t) => {
    const ep = epMap.get(t.examPointId as string);
    return {
      id: t.examPointId as string,
      label_zh: ep?.label ?? (t.examPointId as string),
      description_zh: ep?.descriptionZh ?? null,
      count: t._count._all,
    };
  });

  // Recent writing samples (up to 2, most recent)
  const recent_writing_samples: StudentAnalysisRequest["recent_writing_samples"] =
    writingAttempts.slice(0, 2).flatMap((a) => {
      const payload = a.test.payload as unknown as WritingPayload;
      const stored = a.weakPoints as WritingStored | null;
      const answers = (a.answers ?? {}) as Record<string, string>;
      const chosen = answers.chosenOption;
      const prompt =
        chosen && payload.options
          ? payload.options.find((o) => o.label === chosen)?.prompt ??
            payload.prompt ??
            ""
          : payload.prompt ?? "";
      const response = answers.response ?? "";
      if (!prompt || !response) return [];
      const scores = stored?.scores;
      if (!scores) return [];
      return [
        {
          exam_type: a.test.examType,
          part: a.test.part ?? 0,
          prompt: prompt.slice(0, 800),
          response: response.slice(0, 1200),
          scores: {
            content: scores.content ?? 0,
            communicative: scores.communicative ?? 0,
            organisation: scores.organisation ?? 0,
            language: scores.language ?? 0,
          },
          feedback_zh: stored?.feedback_zh ?? null,
        },
      ];
    });

  const aiReq: StudentAnalysisRequest = {
    student_name: membership.user.name ?? membership.user.email,
    class_name: cls.name,
    stats,
    recent_attempts,
    writing_averages,
    top_error_exam_points,
    recent_writing_samples,
    focus_exam_type: focusExamType ?? null,
  };

  try {
    const analysis = await analyzeStudent(aiReq);
    return NextResponse.json({ analysis });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI 服务失败";
    return NextResponse.json(
      { error: `AI 分析失败：${msg.slice(0, 300)}` },
      { status: 502 },
    );
  }
}
