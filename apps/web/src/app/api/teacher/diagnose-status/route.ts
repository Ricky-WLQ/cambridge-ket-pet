import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/diagnose/week";

export const maxDuration = 60;

/**
 * POST /api/teacher/diagnose-status
 *
 * Body: `{ classId }`.
 *
 * Returns a per-student current-week WeeklyDiagnose summary roll-up for the
 * named class. Drives the teacher dashboard's "who-finished-this-week"
 * widget.
 *
 * Auth + role:
 *  - 401 if not signed in.
 *  - 403 if the caller's role is not TEACHER or ADMIN.
 *  - 403 if the caller does not own the requested class.
 *  - 404 if classId is invalid.
 *
 * Why POST (not GET): consistency with the rest of /api/teacher/* (each
 * route in that namespace takes a JSON body for its parameters). Avoids
 * mixed-style calling conventions on the client.
 *
 * For students with no row this week we surface `status: "NOT_GENERATED"`
 * (a synthetic value not in the DB enum) so the dashboard can render a
 * "haven't started" pill without further DB nullability handling.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }
  const parsed = z.object({ classId: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // Verify role.
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (dbUser?.role !== "TEACHER" && dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  // Verify class ownership + load roster in one round-trip.
  const cls = await prisma.class.findUnique({
    where: { id: parsed.data.classId },
    include: {
      members: {
        select: {
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!cls) {
    return NextResponse.json({ error: "班级不存在" }, { status: 404 });
  }
  if (cls.teacherId !== userId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const weekStart = currentWeekStart();
  const memberIds = cls.members.map((m) => m.userId);

  // Empty class — short-circuit before issuing the WeeklyDiagnose query
  // (Prisma's `in: []` matches no rows but the explicit early-return reads
  // cleaner).
  if (memberIds.length === 0) {
    return NextResponse.json({
      classId: cls.id,
      className: cls.name,
      weekStart: weekStart.toISOString().slice(0, 10),
      students: [],
    });
  }

  const wds = await prisma.weeklyDiagnose.findMany({
    where: { userId: { in: memberIds }, weekStart },
    select: {
      userId: true,
      status: true,
      overallScore: true,
      readingStatus: true,
      listeningStatus: true,
      writingStatus: true,
      speakingStatus: true,
      vocabStatus: true,
      grammarStatus: true,
    },
  });
  const wdByUserId = new Map(wds.map((w) => [w.userId, w] as const));

  const students = cls.members.map((m) => {
    const wd = wdByUserId.get(m.userId);
    return {
      studentId: m.user.id,
      name: m.user.name ?? m.user.email,
      status: wd?.status ?? "NOT_GENERATED",
      overallScore: wd?.overallScore ?? null,
      sectionStatuses: wd
        ? {
            READING: wd.readingStatus,
            LISTENING: wd.listeningStatus,
            WRITING: wd.writingStatus,
            SPEAKING: wd.speakingStatus,
            VOCAB: wd.vocabStatus,
            GRAMMAR: wd.grammarStatus,
          }
        : null,
    };
  });

  return NextResponse.json({
    classId: cls.id,
    className: cls.name,
    weekStart: weekStart.toISOString().slice(0, 10),
    students,
  });
}
