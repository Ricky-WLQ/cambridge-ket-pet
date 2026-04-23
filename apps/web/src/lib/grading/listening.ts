import type { ListeningPart, ListeningQuestion } from "@/lib/audio/types";

export interface QuestionResult {
  questionId: string;
  userAnswer: string | null;
  correctAnswer: string;
  correct: boolean;
  examPointId: string;
  difficultyPointId?: string;
}

export interface WeakPoints {
  examPoints: string[];
  difficultyPoints: string[];
}

export interface ListeningGradeResult {
  rawScore: number;
  totalPossible: number;
  perQuestion: Record<string, QuestionResult>;
  weakPoints: WeakPoints;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function isCorrect(q: ListeningQuestion, userAnswer: string | undefined): boolean {
  if (userAnswer === undefined || userAnswer === null) return false;
  if (q.type === "GAP_FILL_OPEN") {
    return normalize(userAnswer) === normalize(q.answer);
  }
  // MCQ variants + matching: exact option-id match
  return userAnswer === q.answer;
}

function topN<T>(arr: T[], n: number): T[] {
  const counts = new Map<T, number>();
  for (const x of arr) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

export function gradeListening(
  parts: ListeningPart[],
  answers: Record<string, string>
): ListeningGradeResult {
  const perQuestion: Record<string, QuestionResult> = {};
  const wrongExamPoints: string[] = [];
  const wrongDifficultyPoints: string[] = [];
  let raw = 0;
  let total = 0;

  for (const part of parts) {
    for (const q of part.questions) {
      total += 1;
      const user = answers[q.id];
      const correct = isCorrect(q, user);
      if (correct) raw += 1;
      else {
        wrongExamPoints.push(q.examPointId);
        if (q.difficultyPointId) wrongDifficultyPoints.push(q.difficultyPointId);
      }
      perQuestion[q.id] = {
        questionId: q.id,
        userAnswer: user ?? null,
        correctAnswer: q.answer,
        correct,
        examPointId: q.examPointId,
        difficultyPointId: q.difficultyPointId,
      };
    }
  }

  return {
    rawScore: raw,
    totalPossible: total,
    perQuestion,
    weakPoints: {
      examPoints: topN(wrongExamPoints, 3),
      difficultyPoints: topN(wrongDifficultyPoints, 3),
    },
  };
}
