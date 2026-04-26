"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ExamType = "KET" | "PET";
type TestKind = "READING" | "WRITING" | "LISTENING" | "VOCAB";
type WordTier = "CORE" | "RECOMMENDED" | "EXTRA";

const KET_READING_PARTS = [1, 2, 3, 4, 5] as const;
const KET_WRITING_PARTS = [6, 7] as const;
const KET_LISTENING_PARTS = [1, 2, 3, 4, 5] as const;
const PET_READING_PARTS = [1, 2, 3, 4, 5, 6] as const;
const PET_WRITING_PARTS = [1, 2] as const;
const PET_LISTENING_PARTS = [1, 2, 3, 4] as const;

function isValidPart(
  examType: ExamType,
  kind: Exclude<TestKind, "VOCAB">,
  part: number | null,
): boolean {
  if (part === null) return true;
  const allowed =
    examType === "KET" && kind === "READING"
      ? KET_READING_PARTS
      : examType === "KET" && kind === "WRITING"
        ? KET_WRITING_PARTS
        : examType === "KET" && kind === "LISTENING"
          ? KET_LISTENING_PARTS
          : examType === "PET" && kind === "READING"
            ? PET_READING_PARTS
            : examType === "PET" && kind === "WRITING"
              ? PET_WRITING_PARTS
              : PET_LISTENING_PARTS;
  return (allowed as readonly number[]).includes(part);
}

export async function createAssignmentAction(formData: FormData): Promise<void> {
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
  const title = String(formData.get("title") ?? "").trim();
  const description =
    String(formData.get("description") ?? "").trim() || null;
  const examType = String(formData.get("examType") ?? "") as ExamType;
  const kind = String(formData.get("kind") ?? "") as TestKind;
  const dueAtRaw = String(formData.get("dueAt") ?? "").trim();
  const dueAt = dueAtRaw ? new Date(dueAtRaw) : null;

  if (!classId || !title) throw new Error("缺少必要字段");
  if (examType !== "KET" && examType !== "PET")
    throw new Error("科目无效");
  if (
    kind !== "READING" &&
    kind !== "WRITING" &&
    kind !== "LISTENING" &&
    kind !== "VOCAB"
  )
    throw new Error("题型无效（仅支持阅读/写作/听力/词汇）");

  // Per-kind fields. VOCAB uses (targetTier, targetWordCount); paper kinds
  // use (part, minScore). We deliberately leave the other set null to avoid
  // accidentally persisting fields that don't apply.
  let part: number | null = null;
  let minScore: number | null = null;
  let targetTier: WordTier | null = null;
  let targetWordCount: number | null = null;

  if (kind === "VOCAB") {
    const tierRaw = String(formData.get("targetTier") ?? "").trim();
    if (tierRaw && tierRaw !== "ALL") {
      if (
        tierRaw !== "CORE" &&
        tierRaw !== "RECOMMENDED" &&
        tierRaw !== "EXTRA"
      ) {
        throw new Error("目标等级无效");
      }
      targetTier = tierRaw;
    }
    const countRaw = String(formData.get("targetWordCount") ?? "").trim();
    const count = countRaw === "" ? NaN : Number.parseInt(countRaw, 10);
    if (!Number.isFinite(count) || count < 1 || count > 4000) {
      throw new Error("需掌握词数应在 1-4000 之间");
    }
    targetWordCount = count;
  } else {
    const partRaw = String(formData.get("part") ?? "").trim();
    part =
      partRaw === "" || partRaw === "ANY"
        ? null
        : Number.parseInt(partRaw, 10);
    const minScoreRaw = String(formData.get("minScore") ?? "").trim();
    minScore =
      minScoreRaw === "" ? null : Number.parseInt(minScoreRaw, 10);
    if (!isValidPart(examType, kind, part))
      throw new Error(`该 ${examType} ${kind} 不存在 Part ${part}`);
    if (minScore !== null && (minScore < 0 || minScore > 100))
      throw new Error("最低及格分 (0-100) 超出范围");
  }

  // Authz: teacher owns the class
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  if (!cls || cls.teacherId !== userId) {
    throw new Error("班级不存在或无权访问");
  }

  await prisma.assignment.create({
    data: {
      classId,
      title,
      description,
      examType,
      kind,
      part,
      minScore,
      targetTier,
      targetWordCount,
      dueAt,
    },
  });

  redirect(`/teacher/classes/${classId}`);
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!assignmentId) throw new Error("缺少 assignmentId");

  // Ensure the current teacher owns the class this assignment belongs to.
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { classId: true, class: { select: { teacherId: true } } },
  });
  if (!assignment || assignment.class.teacherId !== userId) {
    throw new Error("无权删除该作业");
  }

  await prisma.assignment.delete({ where: { id: assignmentId } });
  redirect(`/teacher/classes/${assignment.classId}`);
}
