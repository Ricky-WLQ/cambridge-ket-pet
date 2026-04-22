"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BODY_LEN = 1000;

export async function createCommentAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const classId = String(formData.get("classId") ?? "").trim();
  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!classId || !targetUserId || !body) {
    throw new Error("缺少必要字段");
  }
  if (body.length > MAX_BODY_LEN) {
    throw new Error(`评论过长（超过 ${MAX_BODY_LEN} 字）`);
  }

  // Authz: teacher owns the class AND targetUserId is a member
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  if (!cls || cls.teacherId !== userId) {
    throw new Error("无权在该班级发表评论");
  }
  const membership = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId: targetUserId } },
    select: { userId: true },
  });
  if (!membership) {
    throw new Error("该学生不在本班级");
  }

  await prisma.comment.create({
    data: { classId, authorId: userId, targetUserId, body },
  });

  revalidatePath(`/teacher/classes/${classId}/students/${targetUserId}`);
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const commentId = String(formData.get("commentId") ?? "").trim();
  if (!commentId) throw new Error("缺少 commentId");

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      authorId: true,
      classId: true,
      targetUserId: true,
      class: { select: { teacherId: true } },
    },
  });
  if (!comment) throw new Error("评论不存在");
  // Only the author may delete their own comment.
  if (comment.authorId !== userId && comment.class.teacherId !== userId) {
    throw new Error("无权删除该评论");
  }

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(
    `/teacher/classes/${comment.classId}/students/${comment.targetUserId}`,
  );
}
