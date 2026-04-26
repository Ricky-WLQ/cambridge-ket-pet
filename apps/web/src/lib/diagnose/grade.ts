/**
 * Deterministic per-section graders for the weekly diagnose.
 *
 * These pure functions grade the 4 auto-gradeable diagnose sections
 * (Reading / Listening / Vocab / Grammar) with no AI calls. Writing +
 * Speaking are graded elsewhere (Writing via gradeWriting in
 * apps/web/src/lib/aiClient.ts; Speaking via the speaking-scorer agent).
 *
 * Consumers:
 *  - /api/diagnose/me/section/[sectionKind]/submit — at submit time.
 *  - /api/cron/diagnose-force-submit-expired — when auto-submitting expired
 *    sections (whatever answers exist get graded).
 *  - /api/diagnose/me/finalize — aggregates per-section scores into the report.
 *
 * Why a parallel implementation (not a delegation to existing graders):
 *  The existing helpers in apps/web/src/lib/grading.ts and
 *  apps/web/src/lib/grading/listening.ts are tied to the practice-flow data
 *  model — they consume `GradableQuestion[]` whose `answer` is a letter
 *  string (e.g. "B") indexed by question id, and an answers map of type
 *  `Record<string, string>`. The diagnose's per-section content shapes
 *  store the correct answer as a numeric `correctIndex` into `options[]`,
 *  and answers come in as a flat positional `(number|null)[]` array. An
 *  adapter that letter-maps every index back and forth would obscure the
 *  scoring rule, so we implement the four graders inline here against the
 *  diagnose-native shapes. The correctness rules (case-insensitive trim
 *  for free-text, exact match for MCQ) match the existing helpers'
 *  semantics.
 */

import type {
  DiagnoseGrammarContent,
  DiagnoseListeningContent,
  DiagnoseListeningQuestion,
  DiagnoseReadingContent,
  DiagnoseVocabContent,
  GrammarAnswers,
  ItemResult,
  ListeningAnswers,
  ReadingAnswers,
  SectionGradeResult,
  VocabAnswers,
} from "./types";

// Re-export for back-compat with existing consumers that import these from
// this module (the canonical home is now `./types`).
export type { ItemResult, SectionGradeResult } from "./types";

/** Compute (rawScore, totalPossible, scaledScore) from a list of correctness flags. */
function computeScore(perItem: ItemResult[]): {
  rawScore: number;
  totalPossible: number;
  scaledScore: number;
} {
  const rawScore = perItem.reduce((n, p) => n + (p.isCorrect ? 1 : 0), 0);
  const totalPossible = perItem.length;
  const scaledScore =
    totalPossible > 0 ? Math.round((rawScore / totalPossible) * 100) : 0;
  return { rawScore, totalPossible, scaledScore };
}

/** Convert a user's selected MCQ index to the option text.
 *  Returns null for null input; returns the literal string "<invalid>" for
 *  out-of-range indexes so downstream wrong-answer collection can spot
 *  malformed payloads. Submit-route Zod should clamp before reaching here.
 */
function optionTextOrNull(
  options: string[],
  userIndex: number | null,
): string | null {
  if (userIndex === null) return null;
  return options[userIndex] ?? "<invalid>";
}

/**
 * Grade a Reading section. Each question carries a `correctIndex` into its
 * `options` array; the user's answer is the index they selected (or null).
 */
export function gradeReadingSection(
  content: DiagnoseReadingContent,
  answers: ReadingAnswers,
): SectionGradeResult {
  const userAnswers = answers.answers ?? [];
  const perItem: ItemResult[] = content.questions.map((q, i) => {
    const userIndex = userAnswers[i] ?? null;
    return {
      questionId: q.id,
      isCorrect: userIndex !== null && userIndex === q.correctIndex,
      userAnswer: optionTextOrNull(q.options, userIndex),
      correctAnswer: q.options[q.correctIndex] ?? "<invalid>",
    };
  });
  return { ...computeScore(perItem), perItem };
}

/**
 * Grade a Listening section. The content has nested `parts[].questions[]`;
 * we flatten in part order so the flat `answers.answers[]` aligns with
 * each question's positional index.
 */
export function gradeListeningSection(
  content: DiagnoseListeningContent,
  answers: ListeningAnswers,
): SectionGradeResult {
  const userAnswers = answers.answers ?? [];
  const flat: DiagnoseListeningQuestion[] = content.parts.flatMap(
    (p) => p.questions,
  );
  const perItem: ItemResult[] = flat.map((q, i) => {
    const userIndex = userAnswers[i] ?? null;
    return {
      questionId: q.id,
      isCorrect: userIndex !== null && userIndex === q.correctIndex,
      userAnswer: optionTextOrNull(q.options, userIndex),
      correctAnswer: q.options[q.correctIndex] ?? "<invalid>",
    };
  });
  return { ...computeScore(perItem), perItem };
}

/**
 * Grade a Vocab fill-blank section. An answer is correct iff
 * `userAnswer.trim().toLowerCase() === item.word.trim().toLowerCase()`.
 *
 * Punctuation is NOT auto-stripped — the `fillPattern` owns punctuation
 * around the blank, so we expect the user to type just the word. null or
 * empty (post-trim) is wrong.
 */
export function gradeVocabSection(
  content: DiagnoseVocabContent,
  answers: VocabAnswers,
): SectionGradeResult {
  const userAnswers = answers.answers ?? [];
  const perItem: ItemResult[] = content.items.map((item, i) => {
    const raw = userAnswers[i] ?? null;
    const trimmed = raw === null ? "" : raw.trim();
    const isCorrect =
      trimmed.length > 0 &&
      trimmed.toLowerCase() === item.word.trim().toLowerCase();
    return {
      questionId: item.wordId,
      isCorrect,
      // Preserve the raw input for the report (null stays null; empty string is preserved as "").
      userAnswer: raw,
      correctAnswer: item.word,
    };
  });
  return { ...computeScore(perItem), perItem };
}

/**
 * Grade a Grammar MCQ section. An answer is correct iff
 * `userAnswer === item.correctIndex`. null is wrong; out-of-range indices
 * are wrong (they cannot equal a valid `correctIndex`).
 */
export function gradeGrammarSection(
  content: DiagnoseGrammarContent,
  answers: GrammarAnswers,
): SectionGradeResult {
  const userAnswers = answers.answers ?? [];
  const perItem: ItemResult[] = content.questions.map((item, i) => {
    const userIndex = userAnswers[i] ?? null;
    return {
      questionId: item.questionId,
      isCorrect: userIndex !== null && userIndex === item.correctIndex,
      userAnswer: optionTextOrNull(item.options, userIndex),
      correctAnswer: item.options[item.correctIndex] ?? "<invalid>",
    };
  });
  return { ...computeScore(perItem), perItem };
}
