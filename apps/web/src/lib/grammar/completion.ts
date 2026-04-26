import type { ExamType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MIN_ATTEMPTS = 10;

export interface GrammarCompletionArgs {
  userId: string;
  examType: ExamType;
  targetTopicId: string | null;
  minScore: number | null;
}

export async function isGrammarAssignmentComplete(args: GrammarCompletionArgs): Promise<boolean> {
  if (args.minScore == null || args.minScore <= 0) return false;
  const where: Prisma.GrammarProgressWhereInput = {
    userId: args.userId,
    examType: args.examType,
  };
  if (args.targetTopicId) where.topicId = args.targetTopicId;
  const rows = await prisma.grammarProgress.findMany({
    where,
    select: { isCorrect: true },
  });
  if (rows.length < MIN_ATTEMPTS) return false;
  const correct = rows.filter((r) => r.isCorrect).length;
  const accuracy = correct / rows.length;
  return accuracy >= args.minScore / 100;
}
