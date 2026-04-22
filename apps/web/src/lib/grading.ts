// Deterministic server-side grader for KET/PET reading tests.
// Pure functions — no DB, no I/O. Safe to TDD in vitest.
//
// Weak-point aggregation here is plain "which exam/difficulty points did the
// student get wrong most often"; narrative AI synthesis is deferred.

export type GradableQuestionType =
  | "MCQ"
  | "OPEN_CLOZE"
  | "MATCHING"
  | "MCQ_CLOZE"
  | "GAPPED_TEXT";

export type GradableQuestion = {
  id: string;
  type: GradableQuestionType;
  answer: string;
  exam_point_id: string;
  difficulty_point_id: string | null;
};

export type WeakPoints = {
  examPoints: Array<{ id: string; errorCount: number }>;
  difficultyPoints: Array<{ id: string; errorCount: number }>;
};

export type GradingResult = {
  rawScore: number;
  totalPossible: number;
  scaledScore: number; // 0-100 percentage, integer-rounded
  perQuestion: Array<{
    id: string;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
  }>;
  weakPoints: WeakPoints;
};

const PUNCT_RE = /[.,!?;:'"`()[\]{}\-_‘’“”]/g;
const WHITESPACE_RE = /\s+/g;

/** Lowercase, strip common punctuation, collapse whitespace, trim. */
export function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(PUNCT_RE, "").replace(WHITESPACE_RE, " ").trim();
}

function isLetterType(t: GradableQuestionType): boolean {
  return t === "MCQ" || t === "MCQ_CLOZE" || t === "MATCHING" || t === "GAPPED_TEXT";
}

export function isAnswerCorrect(
  question: GradableQuestion,
  userAnswer: string,
): boolean {
  const trimmed = userAnswer.trim();
  if (!trimmed) return false;

  if (isLetterType(question.type)) {
    return trimmed.toUpperCase() === question.answer.trim().toUpperCase();
  }

  // OPEN_CLOZE
  return normalizeText(userAnswer) === normalizeText(question.answer);
}

function topN(
  counts: Record<string, number>,
  n = 3,
): Array<{ id: string; errorCount: number }> {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id, errorCount]) => ({ id, errorCount }));
}

export function gradeReading(
  questions: GradableQuestion[],
  answers: Record<string, string>,
): GradingResult {
  const perQuestion = questions.map((q) => {
    const ua = answers[q.id] ?? "";
    return {
      id: q.id,
      isCorrect: isAnswerCorrect(q, ua),
      userAnswer: ua,
      correctAnswer: q.answer,
    };
  });

  const rawScore = perQuestion.filter((p) => p.isCorrect).length;
  const totalPossible = questions.length;
  const scaledScore =
    totalPossible > 0 ? Math.round((rawScore / totalPossible) * 100) : 0;

  const examPointErrors: Record<string, number> = {};
  const difficultyPointErrors: Record<string, number> = {};

  perQuestion.forEach((p, i) => {
    if (p.isCorrect) return;
    const q = questions[i];
    examPointErrors[q.exam_point_id] =
      (examPointErrors[q.exam_point_id] ?? 0) + 1;
    if (q.difficulty_point_id) {
      difficultyPointErrors[q.difficulty_point_id] =
        (difficultyPointErrors[q.difficulty_point_id] ?? 0) + 1;
    }
  });

  return {
    rawScore,
    totalPossible,
    scaledScore,
    perQuestion,
    weakPoints: {
      examPoints: topN(examPointErrors),
      difficultyPoints: topN(difficultyPointErrors),
    },
  };
}
