import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

const joinSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

export async function POST(req: Request) {
  const portal = derivePortalFromRequest(req);
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: pickTone(t.api.malformedRequest, portal) },
      { status: 400 },
    );
  }

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: pickTone(t.api.inviteCodeRequired, portal) },
      { status: 400 },
    );
  }

  const inviteCode = parsed.data.inviteCode.trim().toUpperCase();

  const targetClass = await prisma.class.findUnique({
    where: { inviteCode },
    select: { id: true, name: true, teacherId: true, examFocus: true },
  });

  if (!targetClass) {
    return NextResponse.json(
      { error: pickTone(t.api.inviteCodeInvalid, portal) },
      { status: 404 },
    );
  }

  if (targetClass.teacherId === userId) {
    return NextResponse.json(
      { error: "你是这个班级的教师，无法作为学生加入" },
      { status: 409 },
    );
  }

  const existing = await prisma.classMember.findUnique({
    where: {
      classId_userId: { classId: targetClass.id, userId },
    },
  });

  if (existing) {
    return NextResponse.json(
      {
        error: "你已经是这个班级的成员",
        class: { id: targetClass.id, name: targetClass.name },
      },
      { status: 409 },
    );
  }

  await prisma.classMember.create({
    data: { classId: targetClass.id, userId },
  });

  return NextResponse.json({
    class: {
      id: targetClass.id,
      name: targetClass.name,
      examFocus: targetClass.examFocus,
    },
  });
}
