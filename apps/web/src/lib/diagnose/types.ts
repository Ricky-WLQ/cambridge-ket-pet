/**
 * Shared TypeScript types for the weekly diagnose feature.
 *
 * Why this file exists:
 *  - The diagnose pipeline spans 6 sections, several API routes, an external
 *    AI service (services/ai), a wrong-answer aggregator, severity rules, and
 *    a frontend report. All of those layers must agree on the JSON shapes
 *    that flow through `Test.payload`, `TestAttempt.answers`, and
 *    `WeeklyDiagnose.knowledgePoints`.
 *  - Co-locating these types here lets every consumer import a single source
 *    of truth, so a schema drift in one layer surfaces as a TS error rather
 *    than a silent runtime mismatch.
 *
 * Mirroring rule:
 *  - These shapes mirror the Pydantic schemas in
 *    `services/ai/app/schemas/diagnose.py` (created by T9). The two are kept
 *    in sync manually — there is no codegen — so when you change one, change
 *    the other in the same commit.
 *
 * Adaptation note (vs pretco-app):
 *  - The 8-category knowledge-point taxonomy comes from the pretco-app
 *    diagnostic report. We replaced `translation_skill` with
 *    `cambridge_strategy` because Cambridge KET/PET papers contain no
 *    translation task; the slot is reused for exam-strategy guidance
 *    (timing, skimming, distractor avoidance, answer-sheet discipline).
 */

import type { DiagnoseSectionKind } from "./sectionLimits";

// ─── Knowledge Points (8-category report) ────────────────────────────────────

/** The 8 categories adapted from pretco-app for Cambridge KET/PET context.
 *  `cambridge_strategy` replaces pretco's `translation_skill` (KET/PET has no translation paper).
 */
export type KnowledgePointCategory =
  | "grammar"
  | "collocation"
  | "vocabulary"
  | "sentence_pattern"
  | "reading_skill"
  | "listening_skill"
  | "cambridge_strategy"
  | "writing_skill";

/** Severity of a knowledge-point cluster — derived from how many wrong answers cite it.
 *  Rule: ≥3 → critical, =2 → moderate, =1 → minor.
 */
export type KnowledgePointSeverity = "critical" | "moderate" | "minor";

/** A wrong-answer entry inside a KnowledgePointGroup. Mirrors pretco-app's question shape. */
export interface KnowledgePointQuestion {
  section: DiagnoseSectionKind;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  whyWrong: string;
  rule: string;
}

/** One cluster of related wrong answers grouped under a single knowledge point.
 *  Stored in `WeeklyDiagnose.knowledgePoints` as JSON array.
 */
export interface KnowledgePointGroup {
  knowledgePoint: string;
  category: KnowledgePointCategory;
  miniLesson: string;
  rule: string;
  exampleSentences: string[];
  questions: KnowledgePointQuestion[];
  severity: KnowledgePointSeverity;
}

// ─── Wrong-Answer Input (for the AI analysis call) ───────────────────────────

/** A single wrong answer flattened from a section attempt — input to the AI analysis agent.
 *  Built by `collectWrongAnswers.ts` from the 6 section TestAttempt rows.
 */
export interface WrongAnswer {
  section: DiagnoseSectionKind;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  /** For MCQ sections (Reading, Listening, Grammar, Vocab when MCQ-style). */
  options?: string[];
}

// ─── 4-Field AI Summary (mirrors existing analyze_student response shape) ────

export interface DiagnoseSummary {
  strengths: string[];
  weaknesses: string[];
  priorityActions: string[];
  narrativeZh: string;
}

// ─── Per-Section Scores ──────────────────────────────────────────────────────

/** Score per section after grading. Stored in `WeeklyDiagnose.perSectionScores`.
 *  Each section's value is 0-100 (percent); `null` means the section couldn't be graded
 *  (e.g., AI grading failed, or speaking timed out without a score).
 */
export type PerSectionScores = {
  [K in DiagnoseSectionKind]: number | null;
};

// ─── Generated Content per Section (the parent Test.payload shape) ───────────
//
// SOURCE-OF-TRUTH NOTE: Listening audio metadata (audioR2Key, audioStatus,
// audioSegments) lives on the Test row's columns directly, NOT inside payload.
// Same for speaking (Test.speakingPrompts, Test.speakingPhotoKeys,
// Test.speakingPersona). The shapes below carry only what's actually
// serialized into Test.payload.sections.<KIND>.

/** Reading section content. */
export interface DiagnoseReadingQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  examPointId?: string;
}

export interface DiagnoseReadingContent {
  passage: string | null;
  questions: DiagnoseReadingQuestion[];
  timeLimitSec: 480;
}

/** Listening section content. Audio rendered via Edge-TTS to R2 (status tracked on Test row). */
export interface DiagnoseListeningQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
}

export interface DiagnoseListeningPart {
  partNumber: number;
  partType: string;
  audioStartSec: number;
  audioEndSec: number;
  questions: DiagnoseListeningQuestion[];
}

export interface DiagnoseListeningContent {
  parts: DiagnoseListeningPart[];
  timeLimitSec: 600;
}

/** Writing section — one prompt, AI-graded against Cambridge 4-criteria rubric. */
export interface DiagnoseWritingContent {
  taskType: "EMAIL" | "STORY" | "ARTICLE" | "MESSAGE";
  prompt: string;
  contentPoints: string[];
  minWords: number;
  timeLimitSec: 900;
}

/** Speaking section — one prompt via Akool TRTC avatar (Mina). */
export interface DiagnoseSpeakingContent {
  timeLimitSec: 300;
  // All other content (prompts, photoKeys, persona, initialGreeting) lives
  // on the Test row directly — see Test.speakingPrompts/speakingPhotoKeys/speakingPersona.
}

/** Vocab section — 3 fill-blank items drawn from Word table by weak-topic weighting. */
export interface VocabItem {
  wordId: string;
  /** Denormalized from Word.word. */
  word: string;
  /** e.g. "I want to ____ a book." (the blank stands for `word`). */
  fillPattern: string;
  glossZh?: string;
}

export interface DiagnoseVocabContent {
  items: VocabItem[];
  timeLimitSec: 240;
}

/** Grammar section — 3 MCQs drawn from GrammarQuestion table by weak-topic weighting. */
export interface GrammarItem {
  /** FK to GrammarQuestion.id. */
  questionId: string;
  topicId: string;
  /** Denormalized from GrammarQuestion.questionText. */
  questionText: string;
  options: string[];
  correctIndex: number;
}

export interface DiagnoseGrammarContent {
  questions: GrammarItem[];
  timeLimitSec: 300;
}

/** The full payload stored in `Test.payload` for a diagnose Test row (`kind = DIAGNOSE`). */
export interface DiagnosePayload {
  /** ISO 8601 date YYYY-MM-DD (the CST Monday). */
  weekStart: string;
  /** ISO 8601 date YYYY-MM-DD (the CST Sunday). */
  weekEnd: string;
  /** ISO 8601 datetime when the payload was generated. */
  generatedAt: string;
  examType: "KET" | "PET";
  /** exam_point_ids inherited from last week's wrong-answer analysis; [] in cold start. */
  focusAreas: string[];
  sections: {
    READING: DiagnoseReadingContent;
    LISTENING: DiagnoseListeningContent;
    WRITING: DiagnoseWritingContent;
    SPEAKING: DiagnoseSpeakingContent;
    VOCAB: DiagnoseVocabContent;
    GRAMMAR: DiagnoseGrammarContent;
  };
}

// ─── Per-Section Answer Shapes (for TestAttempt.answers JSON) ────────────────

/** Reading attempt answers — array of selected option indexes (or null for unanswered). */
export interface ReadingAnswers {
  sectionKind: "READING";
  answers: (number | null)[];
}

/** Listening attempt answers. */
export interface ListeningAnswers {
  sectionKind: "LISTENING";
  answers: (number | null)[];
}

/** Writing attempt answers. */
export interface WritingAnswers {
  sectionKind: "WRITING";
  text: string;
}

/** Speaking attempt answers — transcript only; rubric scores live on TestAttempt.rubricScores. */
export interface SpeakingAnswers {
  sectionKind: "SPEAKING";
  // Speaking attempts use the existing TestAttempt.transcript Json column.
  // This wrapper exists for the DiagnoseSectionAnswers union; the actual transcript shape
  // is owned by the speaking pipeline (apps/web/src/components/speaking/*).
}

/** Vocab attempt answers — user's filled-in text per item. */
export interface VocabAnswers {
  sectionKind: "VOCAB";
  answers: (string | null)[];
}

/** Grammar attempt answers — selected option index per item. */
export interface GrammarAnswers {
  sectionKind: "GRAMMAR";
  answers: (number | null)[];
}

/** Discriminated union over all 6 section answer shapes. */
export type DiagnoseSectionAnswers =
  | ReadingAnswers
  | ListeningAnswers
  | WritingAnswers
  | SpeakingAnswers
  | VocabAnswers
  | GrammarAnswers;
