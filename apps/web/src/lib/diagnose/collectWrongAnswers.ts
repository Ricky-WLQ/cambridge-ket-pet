/**
 * Wrong-answer collector for the weekly diagnose AI analyzer (T7).
 *
 * Flattens wrong answers from the 6 graded sections (Reading, Listening,
 * Vocab, Grammar, Writing, Speaking) into a single `WrongAnswer[]` to be
 * fed into the 8-category knowledge-point analyzer agent
 * (services/ai/app/agents/diagnose_*).
 *
 * Ports `collectWrongAnswers` from pretco-app's `src/lib/diagnostic-analysis.ts`
 * (lines ~411-552), adapted for Cambridge KET/PET:
 *  - Section names: READING/LISTENING/VOCAB/GRAMMAR/WRITING/SPEAKING
 *    (instead of pretco's reading/listening/cloze/translation/writing).
 *  - The 8th category is `cambridge_strategy` rather than pretco's
 *    `translation_skill` — but that mapping is handled downstream by the
 *    AI agent; this file only flattens to `WrongAnswer[]`.
 *  - Writing + Speaking use Cambridge 4-criteria rubrics (each 0-5 instead
 *    of pretco's 0-10). Threshold for "weak" is < 4 of 5.
 *
 * Why a 40-entry cap?
 *  - Bounds the size of the AI prompt (each WrongAnswer becomes ~5-6 lines
 *    of context inside the analysis call). Pretco-app uses the same cap; we
 *    preserve it to keep prompt-size and rate-limit behavior predictable.
 *
 * Section ordering — READING → LISTENING → VOCAB → GRAMMAR → WRITING →
 * SPEAKING — matches the natural runner UI order. The 40-cap truncates from
 * the tail of the pushed list, so high-priority earlier sections (the MCQ
 * sections that produce many wrong items in one go) keep their full
 * representation while the rubric-synthesized writing/speaking entries get
 * dropped first if the cap binds.
 *
 * Pure: no I/O, no module mutation. Imports only from `./types` and `./grade`.
 */

import type { DiagnosePayload, WrongAnswer } from "./types";
import type { SectionGradeResult } from "./grade";

/** Per-section grade results (4 auto-graded + 2 AI-graded). */
export interface DiagnoseGradeResults {
  READING: SectionGradeResult;
  LISTENING: SectionGradeResult;
  VOCAB: SectionGradeResult;
  GRAMMAR: SectionGradeResult;
  /** Writing rubric scores (Cambridge 4-criteria, each 0-5) + feedback string. Null if AI grading failed. */
  WRITING: WritingGrade | null;
  /** Speaking rubric scores + transcript. Null if AI grading failed or speaking pending. */
  SPEAKING: SpeakingGrade | null;
}

export interface WritingGrade {
  scores: {
    content: number; // 0-5
    communicative: number; // 0-5
    organisation: number; // 0-5
    language: number; // 0-5
  };
  feedbackZh: string;
}

export interface SpeakingGrade {
  scores: {
    grammar: number; // 0-5 (Cambridge speaking rubric criteria)
    vocabulary: number; // 0-5
    pronunciation: number; // 0-5
    interactiveCommunication: number; // 0-5
  };
  transcript: string; // user's spoken response (transcribed)
}

/** Maximum wrong answers collected — bounds the AI analysis prompt size. */
const MAX_WRONG_ANSWERS = 40;

/** Threshold below which a rubric criterion (0-5 scale) is considered weak. */
const RUBRIC_WEAK_THRESHOLD = 4;

const UNANSWERED_PLACEHOLDER = "(未作答)";
const UNRECOGNIZED_PLACEHOLDER = "(未识别)";

/**
 * Collect wrong answers / weak-area entries across all 6 sections.
 *
 * - For Reading/Listening/Vocab/Grammar: each `perItem` entry with
 *   `isCorrect === false` produces one WrongAnswer mirroring the question
 *   text and options from the payload.
 * - For Writing: if any rubric score < 4 (of 5), produces one synthesized
 *   WrongAnswer per weak criterion (with feedbackZh as userAnswer + the
 *   ideal-state Chinese text as correctAnswer).
 * - For Speaking: same pattern — one synthesized WrongAnswer per weak
 *   rubric criterion (uses transcript as userAnswer; placeholder when
 *   transcript is empty).
 *
 * Order: READING → LISTENING → VOCAB → GRAMMAR → WRITING → SPEAKING.
 * Total capped at {@link MAX_WRONG_ANSWERS}.
 */
export function collectWrongAnswers(
  payload: DiagnosePayload,
  results: DiagnoseGradeResults,
): WrongAnswer[] {
  const wrongAnswers: WrongAnswer[] = [];

  // ─── READING ──────────────────────────────────────────────────────────────
  const readingQuestions = payload.sections.READING.questions;
  results.READING.perItem.forEach((item, i) => {
    if (item.isCorrect) return;
    const q = readingQuestions[i];
    wrongAnswers.push({
      section: "READING",
      questionText: q?.text ?? `READING #${i + 1}`,
      userAnswer: item.userAnswer ?? UNANSWERED_PLACEHOLDER,
      correctAnswer: item.correctAnswer,
      options: q?.options,
    });
  });

  // ─── LISTENING ────────────────────────────────────────────────────────────
  // Listening flattens parts[].questions[] in the same order as grade.ts.
  const listeningFlat = payload.sections.LISTENING.parts.flatMap(
    (p) => p.questions,
  );
  results.LISTENING.perItem.forEach((item, i) => {
    if (item.isCorrect) return;
    const q = listeningFlat[i];
    wrongAnswers.push({
      section: "LISTENING",
      questionText: q?.text ?? `LISTENING #${i + 1}`,
      userAnswer: item.userAnswer ?? UNANSWERED_PLACEHOLDER,
      correctAnswer: item.correctAnswer,
      options: q?.options,
    });
  });

  // ─── VOCAB ────────────────────────────────────────────────────────────────
  // Vocab is fill-blank (not MCQ) — questionText is the fillPattern, options omitted.
  const vocabItems = payload.sections.VOCAB.items;
  results.VOCAB.perItem.forEach((item, i) => {
    if (item.isCorrect) return;
    const v = vocabItems[i];
    wrongAnswers.push({
      section: "VOCAB",
      questionText: v?.fillPattern ?? `VOCAB #${i + 1}`,
      userAnswer: item.userAnswer ?? UNANSWERED_PLACEHOLDER,
      correctAnswer: item.correctAnswer,
      // No options — fill-blank.
    });
  });

  // ─── GRAMMAR ──────────────────────────────────────────────────────────────
  const grammarQuestions = payload.sections.GRAMMAR.questions;
  results.GRAMMAR.perItem.forEach((item, i) => {
    if (item.isCorrect) return;
    const q = grammarQuestions[i];
    wrongAnswers.push({
      section: "GRAMMAR",
      questionText: q?.questionText ?? `GRAMMAR #${i + 1}`,
      userAnswer: item.userAnswer ?? UNANSWERED_PLACEHOLDER,
      correctAnswer: item.correctAnswer,
      options: q?.options,
    });
  });

  // ─── WRITING (synthesize one WrongAnswer per weak rubric criterion) ──────
  if (results.WRITING) {
    const { scores, feedbackZh } = results.WRITING;
    if (scores.content < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "WRITING",
        questionText: "写作内容完整性",
        userAnswer: feedbackZh,
        correctAnswer: "内容完整、切题、覆盖全部要点",
      });
    }
    if (scores.communicative < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "WRITING",
        questionText: "写作交际效果",
        userAnswer: feedbackZh,
        correctAnswer: "信息有效传达、语气得当",
      });
    }
    if (scores.organisation < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "WRITING",
        questionText: "写作篇章组织",
        userAnswer: feedbackZh,
        correctAnswer: "结构清晰、逻辑连贯",
      });
    }
    if (scores.language < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "WRITING",
        questionText: "写作语言准确性",
        userAnswer: feedbackZh,
        correctAnswer: "语法准确、用词得当",
      });
    }
  }

  // ─── SPEAKING (synthesize one WrongAnswer per weak rubric criterion) ─────
  if (results.SPEAKING) {
    const { scores, transcript } = results.SPEAKING;
    const userAnswer = transcript || UNRECOGNIZED_PLACEHOLDER;
    if (scores.grammar < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "SPEAKING",
        questionText: "口语语法准确性",
        userAnswer,
        correctAnswer: "语法准确、句式多样",
      });
    }
    if (scores.vocabulary < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "SPEAKING",
        questionText: "口语词汇运用",
        userAnswer,
        correctAnswer: "词汇丰富、表达精准",
      });
    }
    if (scores.pronunciation < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "SPEAKING",
        questionText: "口语发音",
        userAnswer,
        correctAnswer: "发音清晰、语调自然",
      });
    }
    if (scores.interactiveCommunication < RUBRIC_WEAK_THRESHOLD) {
      wrongAnswers.push({
        section: "SPEAKING",
        questionText: "口语互动交流",
        userAnswer,
        correctAnswer: "交流流畅、互动自然",
      });
    }
  }

  // ─── Cap to bound AI prompt size ──────────────────────────────────────────
  if (wrongAnswers.length > MAX_WRONG_ANSWERS) {
    return wrongAnswers.slice(0, MAX_WRONG_ANSWERS);
  }
  return wrongAnswers;
}
