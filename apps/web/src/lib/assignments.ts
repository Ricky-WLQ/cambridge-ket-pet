// Shared helpers for reading assignments and deriving per-student completion.
// Completion is NOT stored — it's derived from matching TestAttempt rows.
// See schema.prisma Assignment comment for rationale.

import type { ExamType, TestKind } from "@prisma/client";
import { prisma } from "./prisma";

export type StudentAssignment = {
  id: string;
  title: string;
  description: string | null;
  examType: ExamType;
  kind: TestKind;
  part: number | null;
  minScore: number | null;
  dueAt: Date | null;
  className: string;
  classId: string;
  completed: boolean;
  bestScore: number | null; // 0-100 scaled, from best matching graded attempt
  attemptsCount: number; // number of graded matching attempts
};

/**
 * All currently-active assignments for the given student, optionally filtered
 * to one exam type (used by /ket and /pet portal pages).
 * Completion is derived: a student "completed" an assignment iff they have a
 * GRADED TestAttempt on a Test that matches (examType, kind, optional part)
 * AND (minScore null OR scaledScore >= minScore).
 */
export async function getStudentAssignments(
  userId: string,
  filter?: { examType?: ExamType },
): Promise<StudentAssignment[]> {
  const memberships = await prisma.classMember.findMany({
    where: { userId },
    select: {
      classId: true,
      class: { select: { id: true, name: true } },
    },
  });
  const classIds = memberships.map((m) => m.classId);
  if (classIds.length === 0) return [];

  const classNameMap = new Map(memberships.map((m) => [m.classId, m.class.name]));

  const assignments = await prisma.assignment.findMany({
    where: {
      classId: { in: classIds },
      ...(filter?.examType ? { examType: filter.examType } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  if (assignments.length === 0) return [];

  // Fetch all GRADED attempts once; filter in-memory per assignment.
  // Cheaper than N+1 queries.
  const attempts = await prisma.testAttempt.findMany({
    where: {
      userId,
      status: "GRADED",
    },
    select: {
      scaledScore: true,
      test: {
        select: { examType: true, kind: true, part: true },
      },
    },
  });

  return assignments.map((a) => {
    const matching = attempts.filter(
      (att) =>
        att.test.examType === a.examType &&
        att.test.kind === a.kind &&
        (a.part === null || att.test.part === a.part),
    );
    const passing = matching.filter(
      (att) =>
        att.scaledScore !== null &&
        (a.minScore === null || att.scaledScore >= a.minScore),
    );
    const best =
      matching.length === 0
        ? null
        : matching.reduce(
            (mx, att) =>
              att.scaledScore !== null && att.scaledScore > mx
                ? att.scaledScore
                : mx,
            0,
          );
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      examType: a.examType,
      kind: a.kind,
      part: a.part,
      minScore: a.minScore,
      dueAt: a.dueAt,
      className: classNameMap.get(a.classId) ?? "",
      classId: a.classId,
      completed: passing.length > 0,
      bestScore: best,
      attemptsCount: matching.length,
    };
  });
}

export type ClassAssignmentWithCounts = {
  id: string;
  title: string;
  description: string | null;
  examType: ExamType;
  kind: TestKind;
  part: number | null;
  minScore: number | null;
  dueAt: Date | null;
  createdAt: Date;
  totalStudents: number;
  completedStudents: number;
};

/**
 * Teacher-facing: list a class's assignments with per-assignment completion
 * counts across members.
 */
export async function getClassAssignments(
  classId: string,
): Promise<ClassAssignmentWithCounts[]> {
  const [assignments, memberUserIds] = await Promise.all([
    prisma.assignment.findMany({
      where: { classId },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    }),
    prisma.classMember
      .findMany({
        where: { classId },
        select: { userId: true },
      })
      .then((rows) => rows.map((r) => r.userId)),
  ]);

  if (assignments.length === 0) return [];

  const totalStudents = memberUserIds.length;
  if (totalStudents === 0) {
    return assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      examType: a.examType,
      kind: a.kind,
      part: a.part,
      minScore: a.minScore,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      totalStudents: 0,
      completedStudents: 0,
    }));
  }

  // One query for all matching graded attempts by any class member.
  const attempts = await prisma.testAttempt.findMany({
    where: {
      userId: { in: memberUserIds },
      status: "GRADED",
    },
    select: {
      userId: true,
      scaledScore: true,
      test: {
        select: { examType: true, kind: true, part: true },
      },
    },
  });

  return assignments.map((a) => {
    const passingUserIds = new Set<string>();
    for (const att of attempts) {
      if (
        att.test.examType !== a.examType ||
        att.test.kind !== a.kind ||
        (a.part !== null && att.test.part !== a.part) ||
        att.scaledScore === null
      ) {
        continue;
      }
      if (a.minScore !== null && att.scaledScore < a.minScore) continue;
      passingUserIds.add(att.userId);
    }
    return {
      id: a.id,
      title: a.title,
      description: a.description,
      examType: a.examType,
      kind: a.kind,
      part: a.part,
      minScore: a.minScore,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      totalStudents,
      completedStudents: passingUserIds.size,
    };
  });
}
