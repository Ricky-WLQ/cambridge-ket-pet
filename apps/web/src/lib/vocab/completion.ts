import type { ExamType, Prisma, WordTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MASTERY_MASTERED_THRESHOLD } from "./srs";

export interface VocabCompletionArgs {
  userId: string;
  examType: ExamType;
  targetTier: WordTier | null;
  targetWordCount: number | null;
}

/**
 * Derived VOCAB-assignment completion: a student is "done" with a VOCAB
 * assignment iff they have mastered (mastery >= MASTERY_MASTERED_THRESHOLD)
 * at least `targetWordCount` words within `examType`, optionally restricted
 * to `targetTier` (null = any tier counts).
 *
 * Misconfigured assignments (no targetWordCount, or 0/negative) never count
 * as complete — the teacher must set a positive target.
 */
export async function isVocabAssignmentComplete(args: VocabCompletionArgs): Promise<boolean> {
  if (args.targetWordCount == null || args.targetWordCount <= 0) return false;
  const where: Prisma.VocabProgressWhereInput = {
    userId: args.userId,
    examType: args.examType,
    mastery: { gte: MASTERY_MASTERED_THRESHOLD },
  };
  if (args.targetTier) where.wordRef = { tier: args.targetTier };
  const count = await prisma.vocabProgress.count({ where });
  return count >= args.targetWordCount;
}
