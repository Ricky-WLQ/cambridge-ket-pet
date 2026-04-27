/**
 * Vitest suite for the wrong-answer collector (T7).
 *
 * Covers all 6 sections (Reading, Listening, Vocab, Grammar, Writing,
 * Speaking), the rubric-synthesis paths for Writing/Speaking, the null
 * grade results, the empty-transcript placeholder, the cross-section
 * ordering invariant, and the 40-entry cap.
 */

import { describe, expect, test } from "vitest";
import { collectWrongAnswers } from "../collectWrongAnswers";
import type {
  DiagnoseGradeResults,
  SpeakingGrade,
  WritingGrade,
} from "../collectWrongAnswers";
import type { SectionGradeResult, ItemResult } from "../grade";
import type {
  DiagnosePayload,
  DiagnoseListeningPart,
} from "../types";

// ─── builders ─────────────────────────────────────────────────────────────

/** Build a payload with the given per-section content. */
function buildPayload(overrides?: {
  reading?: { id: string; text: string; options: string[]; correctIndex: number }[];
  listeningParts?: {
    partNumber: number;
    questions: { id: string; text: string; options: string[]; correctIndex: number }[];
  }[];
  vocab?: { wordId: string; word: string; fillPattern: string }[];
  grammar?: {
    questionId: string;
    questionText: string;
    options: string[];
    correctIndex: number;
  }[];
}): DiagnosePayload {
  const readingQuestions = overrides?.reading ?? [];
  const listeningParts: DiagnoseListeningPart[] = (overrides?.listeningParts ?? []).map(
    (p) => ({
      partNumber: p.partNumber,
      partType: "MCQ",
      audioStartSec: 0,
      audioEndSec: 30,
      questions: p.questions.map((q) => ({
        id: q.id,
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
    }),
  );
  const vocabItems = overrides?.vocab ?? [];
  const grammarQuestions = (overrides?.grammar ?? []).map((g) => ({
    questionId: g.questionId,
    topicId: "topic-x",
    questionText: g.questionText,
    options: g.options,
    correctIndex: g.correctIndex,
  }));

  return {
    weekStart: "2026-04-20",
    weekEnd: "2026-04-26",
    generatedAt: "2026-04-20T00:00:00.000Z",
    examType: "PET",
    focusAreas: [],
    sections: {
      READING: {
        passage: "passage",
        questions: readingQuestions,
        timeLimitSec: 480,
      },
      LISTENING: {
        parts: listeningParts,
        timeLimitSec: 600,
      },
      WRITING: {
        taskType: "EMAIL",
        prompt: "Write to your friend.",
        contentPoints: [],
        minWords: 100,
        timeLimitSec: 900,
      },
      SPEAKING: {
        timeLimitSec: 300,
      },
      VOCAB: {
        items: vocabItems,
        timeLimitSec: 240,
      },
      GRAMMAR: {
        questions: grammarQuestions,
        timeLimitSec: 300,
      },
    },
  };
}

/** Build a SectionGradeResult from a list of `ItemResult`. */
function buildSectionResult(perItem: ItemResult[]): SectionGradeResult {
  const rawScore = perItem.reduce((n, p) => n + (p.isCorrect ? 1 : 0), 0);
  const totalPossible = perItem.length;
  const scaledScore =
    totalPossible > 0 ? Math.round((rawScore / totalPossible) * 100) : 0;
  return { rawScore, totalPossible, scaledScore, perItem };
}

/** Build full default `DiagnoseGradeResults` with empty perItem for all sections. */
function emptyResults(
  overrides?: Partial<DiagnoseGradeResults>,
): DiagnoseGradeResults {
  const empty = buildSectionResult([]);
  return {
    READING: empty,
    LISTENING: empty,
    VOCAB: empty,
    GRAMMAR: empty,
    WRITING: null,
    SPEAKING: null,
    ...overrides,
  };
}

const PERFECT_WRITING: WritingGrade = {
  scores: { content: 5, communicative: 5, organisation: 5, language: 5 },
  feedbackZh: "Great work!",
};

const PERFECT_SPEAKING: SpeakingGrade = {
  scores: {
    grammar: 5,
    vocabulary: 5,
    pronunciation: 5,
    interactiveCommunication: 5,
  },
  transcript: "I went to the park yesterday and had a lovely time.",
};

// ─── 1. Empty case ────────────────────────────────────────────────────────

describe("collectWrongAnswers — empty", () => {
  test("all results have 0 wrong items → returns empty array", () => {
    const payload = buildPayload();
    const results = emptyResults();
    expect(collectWrongAnswers(payload, results)).toEqual([]);
  });
});

// ─── 2. Single Reading wrong ──────────────────────────────────────────────

describe("collectWrongAnswers — Reading", () => {
  test("single wrong reading question → 1 WrongAnswer with options[]", () => {
    const payload = buildPayload({
      reading: [
        { id: "r1", text: "What is the main idea?", options: ["A", "B", "C"], correctIndex: 1 },
      ],
    });
    const results = emptyResults({
      READING: buildSectionResult([
        { questionId: "r1", isCorrect: false, userAnswer: "A", correctAnswer: "B" },
      ]),
    });
    const out = collectWrongAnswers(payload, results);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      section: "READING",
      questionText: "What is the main idea?",
      userAnswer: "A",
      correctAnswer: "B",
      options: ["A", "B", "C"],
    });
  });
});

// ─── 3. All Listening wrong, multi-part ───────────────────────────────────

describe("collectWrongAnswers — Listening", () => {
  test("2 parts × 2 questions = 4 items all wrong → 4 WrongAnswers in flat order", () => {
    const payload = buildPayload({
      listeningParts: [
        {
          partNumber: 1,
          questions: [
            { id: "l1", text: "L1?", options: ["x", "y"], correctIndex: 0 },
            { id: "l2", text: "L2?", options: ["x", "y"], correctIndex: 1 },
          ],
        },
        {
          partNumber: 2,
          questions: [
            { id: "l3", text: "L3?", options: ["m", "n"], correctIndex: 0 },
            { id: "l4", text: "L4?", options: ["m", "n"], correctIndex: 1 },
          ],
        },
      ],
    });
    const results = emptyResults({
      LISTENING: buildSectionResult([
        { questionId: "l1", isCorrect: false, userAnswer: "y", correctAnswer: "x" },
        { questionId: "l2", isCorrect: false, userAnswer: "x", correctAnswer: "y" },
        { questionId: "l3", isCorrect: false, userAnswer: "n", correctAnswer: "m" },
        { questionId: "l4", isCorrect: false, userAnswer: null, correctAnswer: "n" },
      ]),
    });
    const out = collectWrongAnswers(payload, results);
    expect(out).toHaveLength(4);
    expect(out.map((w) => w.questionText)).toEqual(["L1?", "L2?", "L3?", "L4?"]);
    expect(out.map((w) => w.section)).toEqual([
      "LISTENING",
      "LISTENING",
      "LISTENING",
      "LISTENING",
    ]);
    // null userAnswer becomes the unanswered placeholder
    expect(out[3].userAnswer).toBe("(未作答)");
    // options array preserved
    expect(out[0].options).toEqual(["x", "y"]);
  });
});

// ─── 4. Vocab fill-blank ──────────────────────────────────────────────────

describe("collectWrongAnswers — Vocab", () => {
  test("1 wrong vocab → questionText is fillPattern, no options", () => {
    const payload = buildPayload({
      vocab: [
        { wordId: "v1", word: "happy", fillPattern: "I feel ____ today." },
      ],
    });
    const results = emptyResults({
      VOCAB: buildSectionResult([
        { questionId: "v1", isCorrect: false, userAnswer: "sad", correctAnswer: "happy" },
      ]),
    });
    const out = collectWrongAnswers(payload, results);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      section: "VOCAB",
      questionText: "I feel ____ today.",
      userAnswer: "sad",
      correctAnswer: "happy",
    });
    // No options key on Vocab.
    expect(out[0].options).toBeUndefined();
  });
});

// ─── 5. Grammar wrong ─────────────────────────────────────────────────────

describe("collectWrongAnswers — Grammar", () => {
  test("1 wrong grammar question → WrongAnswer with options[]", () => {
    const payload = buildPayload({
      grammar: [
        {
          questionId: "g1",
          questionText: "She _____ to school every day.",
          options: ["go", "goes", "gone"],
          correctIndex: 1,
        },
      ],
    });
    const results = emptyResults({
      GRAMMAR: buildSectionResult([
        { questionId: "g1", isCorrect: false, userAnswer: "go", correctAnswer: "goes" },
      ]),
    });
    const out = collectWrongAnswers(payload, results);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      section: "GRAMMAR",
      questionText: "She _____ to school every day.",
      userAnswer: "go",
      correctAnswer: "goes",
      options: ["go", "goes", "gone"],
    });
  });
});

// ─── 6. Writing weak content ──────────────────────────────────────────────

describe("collectWrongAnswers — Writing weak content", () => {
  test("content=3, others=5 → 1 WrongAnswer for content with feedbackZh", () => {
    const payload = buildPayload();
    const writing: WritingGrade = {
      scores: { content: 3, communicative: 5, organisation: 5, language: 5 },
      feedbackZh: "内容覆盖不足。",
    };
    const out = collectWrongAnswers(payload, emptyResults({ WRITING: writing }));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      section: "WRITING",
      questionText: "写作内容完整性",
      userAnswer: "内容覆盖不足。",
      correctAnswer: "内容完整、切题、覆盖全部要点",
    });
  });
});

// ─── 7. Writing all weak ──────────────────────────────────────────────────

describe("collectWrongAnswers — Writing all weak", () => {
  test("all 4 criteria < 4 → 4 WrongAnswers", () => {
    const payload = buildPayload();
    const writing: WritingGrade = {
      scores: { content: 1, communicative: 2, organisation: 3, language: 0 },
      feedbackZh: "需要全面提升。",
    };
    const out = collectWrongAnswers(payload, emptyResults({ WRITING: writing }));
    expect(out).toHaveLength(4);
    expect(out.map((w) => w.questionText)).toEqual([
      "写作内容完整性",
      "写作交际效果",
      "写作篇章组织",
      "写作语言准确性",
    ]);
    expect(out.every((w) => w.section === "WRITING")).toBe(true);
    expect(out.every((w) => w.userAnswer === "需要全面提升。")).toBe(true);
  });
});

// ─── 8. Writing all strong ────────────────────────────────────────────────

describe("collectWrongAnswers — Writing all strong", () => {
  test("all >= 4 → 0 writing WrongAnswers", () => {
    const payload = buildPayload();
    const out = collectWrongAnswers(
      payload,
      emptyResults({ WRITING: PERFECT_WRITING }),
    );
    expect(out).toHaveLength(0);
  });

  test("threshold edge: exactly 4 is NOT weak", () => {
    const payload = buildPayload();
    const writing: WritingGrade = {
      scores: { content: 4, communicative: 4, organisation: 4, language: 4 },
      feedbackZh: "Borderline.",
    };
    const out = collectWrongAnswers(payload, emptyResults({ WRITING: writing }));
    expect(out).toHaveLength(0);
  });
});

// ─── 9. Writing null ──────────────────────────────────────────────────────

describe("collectWrongAnswers — Writing null", () => {
  test("WRITING: null → 0 writing WrongAnswers", () => {
    const payload = buildPayload();
    const out = collectWrongAnswers(payload, emptyResults({ WRITING: null }));
    expect(out).toHaveLength(0);
  });
});

// ─── 10. Speaking weak grammar ────────────────────────────────────────────

describe("collectWrongAnswers — Speaking weak grammar", () => {
  test("speaking grammar < 4 → 1 WrongAnswer with transcript as userAnswer", () => {
    const payload = buildPayload();
    const speaking: SpeakingGrade = {
      scores: {
        grammar: 2,
        vocabulary: 5,
        pronunciation: 5,
        interactiveCommunication: 5,
      },
      transcript: "I goes to school yesterday.",
    };
    const out = collectWrongAnswers(payload, emptyResults({ SPEAKING: speaking }));
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      section: "SPEAKING",
      questionText: "口语语法准确性",
      userAnswer: "I goes to school yesterday.",
      correctAnswer: "语法准确、句式多样",
    });
  });
});

// ─── 11. Speaking null ────────────────────────────────────────────────────

describe("collectWrongAnswers — Speaking null", () => {
  test("SPEAKING: null → 0 speaking WrongAnswers", () => {
    const payload = buildPayload();
    const out = collectWrongAnswers(payload, emptyResults({ SPEAKING: null }));
    expect(out).toHaveLength(0);
  });
});

// ─── 12. Speaking with empty transcript ───────────────────────────────────

describe("collectWrongAnswers — Speaking empty transcript", () => {
  test("transcript === '' and a weak rubric → userAnswer is '(未识别)'", () => {
    const payload = buildPayload();
    const speaking: SpeakingGrade = {
      scores: {
        grammar: 5,
        vocabulary: 5,
        pronunciation: 1,
        interactiveCommunication: 5,
      },
      transcript: "",
    };
    const out = collectWrongAnswers(payload, emptyResults({ SPEAKING: speaking }));
    expect(out).toHaveLength(1);
    expect(out[0].userAnswer).toBe("(未识别)");
    expect(out[0].questionText).toBe("口语发音");
  });

  test("all 4 speaking criteria weak with empty transcript → 4 WrongAnswers all using placeholder", () => {
    const payload = buildPayload();
    const speaking: SpeakingGrade = {
      scores: {
        grammar: 0,
        vocabulary: 0,
        pronunciation: 0,
        interactiveCommunication: 0,
      },
      transcript: "",
    };
    const out = collectWrongAnswers(payload, emptyResults({ SPEAKING: speaking }));
    expect(out).toHaveLength(4);
    expect(out.every((w) => w.userAnswer === "(未识别)")).toBe(true);
    expect(out.map((w) => w.questionText)).toEqual([
      "口语语法准确性",
      "口语词汇运用",
      "口语发音",
      "口语互动交流",
    ]);
  });
});

// ─── 13. Cross-section mix ────────────────────────────────────────────────

describe("collectWrongAnswers — cross-section mix", () => {
  test("3 reading + 2 listening + 1 vocab + 1 grammar + 2 writing + 1 speaking = 10", () => {
    const payload = buildPayload({
      reading: [
        { id: "r1", text: "R1?", options: ["a", "b"], correctIndex: 0 },
        { id: "r2", text: "R2?", options: ["a", "b"], correctIndex: 0 },
        { id: "r3", text: "R3?", options: ["a", "b"], correctIndex: 0 },
      ],
      listeningParts: [
        {
          partNumber: 1,
          questions: [
            { id: "l1", text: "L1?", options: ["x", "y"], correctIndex: 0 },
            { id: "l2", text: "L2?", options: ["x", "y"], correctIndex: 1 },
          ],
        },
      ],
      vocab: [{ wordId: "v1", word: "happy", fillPattern: "I feel ____." }],
      grammar: [
        {
          questionId: "g1",
          questionText: "She ____ to school.",
          options: ["go", "goes"],
          correctIndex: 1,
        },
      ],
    });
    const writing: WritingGrade = {
      scores: { content: 3, communicative: 3, organisation: 5, language: 5 },
      feedbackZh: "Need work.",
    };
    const speaking: SpeakingGrade = {
      scores: {
        grammar: 2,
        vocabulary: 5,
        pronunciation: 5,
        interactiveCommunication: 5,
      },
      transcript: "I speak now.",
    };
    const results: DiagnoseGradeResults = {
      READING: buildSectionResult([
        { questionId: "r1", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
        { questionId: "r2", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
        { questionId: "r3", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
      ]),
      LISTENING: buildSectionResult([
        { questionId: "l1", isCorrect: false, userAnswer: "y", correctAnswer: "x" },
        { questionId: "l2", isCorrect: false, userAnswer: "x", correctAnswer: "y" },
      ]),
      VOCAB: buildSectionResult([
        { questionId: "v1", isCorrect: false, userAnswer: "sad", correctAnswer: "happy" },
      ]),
      GRAMMAR: buildSectionResult([
        { questionId: "g1", isCorrect: false, userAnswer: "go", correctAnswer: "goes" },
      ]),
      WRITING: writing,
      SPEAKING: speaking,
    };
    const out = collectWrongAnswers(payload, results);
    expect(out).toHaveLength(10);
    expect(out.map((w) => w.section)).toEqual([
      "READING",
      "READING",
      "READING",
      "LISTENING",
      "LISTENING",
      "VOCAB",
      "GRAMMAR",
      "WRITING",
      "WRITING",
      "SPEAKING",
    ]);
  });
});

// ─── 14. Cap at 40 ────────────────────────────────────────────────────────

describe("collectWrongAnswers — cap at 40", () => {
  test("50 wrong items → output is exactly 40 (front-most preserved)", () => {
    // Build 50 reading wrongs.
    const readingQuestions = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      text: `Reading Q${i}`,
      options: ["a", "b"],
      correctIndex: 0,
    }));
    const payload = buildPayload({ reading: readingQuestions });
    const readingItems: ItemResult[] = readingQuestions.map((q) => ({
      questionId: q.id,
      isCorrect: false,
      userAnswer: "b",
      correctAnswer: "a",
    }));
    const out = collectWrongAnswers(
      payload,
      emptyResults({ READING: buildSectionResult(readingItems) }),
    );
    expect(out).toHaveLength(40);
    // First 40 preserved (questionText 0..39).
    expect(out[0].questionText).toBe("Reading Q0");
    expect(out[39].questionText).toBe("Reading Q39");
  });
});

// ─── 15. Section ordering ─────────────────────────────────────────────────

describe("collectWrongAnswers — section ordering", () => {
  test("READING → LISTENING → VOCAB → GRAMMAR → WRITING → SPEAKING", () => {
    // 1 wrong per section to verify pure ordering.
    const payload = buildPayload({
      reading: [{ id: "r1", text: "R", options: ["a", "b"], correctIndex: 0 }],
      listeningParts: [
        {
          partNumber: 1,
          questions: [
            { id: "l1", text: "L", options: ["a", "b"], correctIndex: 0 },
          ],
        },
      ],
      vocab: [{ wordId: "v1", word: "happy", fillPattern: "I feel ____." }],
      grammar: [
        {
          questionId: "g1",
          questionText: "G",
          options: ["a", "b"],
          correctIndex: 0,
        },
      ],
    });
    const writing: WritingGrade = {
      scores: { content: 0, communicative: 5, organisation: 5, language: 5 },
      feedbackZh: "fb",
    };
    const speaking: SpeakingGrade = {
      scores: {
        grammar: 0,
        vocabulary: 5,
        pronunciation: 5,
        interactiveCommunication: 5,
      },
      transcript: "spoken",
    };
    const out = collectWrongAnswers(payload, {
      READING: buildSectionResult([
        { questionId: "r1", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
      ]),
      LISTENING: buildSectionResult([
        { questionId: "l1", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
      ]),
      VOCAB: buildSectionResult([
        { questionId: "v1", isCorrect: false, userAnswer: "sad", correctAnswer: "happy" },
      ]),
      GRAMMAR: buildSectionResult([
        { questionId: "g1", isCorrect: false, userAnswer: "b", correctAnswer: "a" },
      ]),
      WRITING: writing,
      SPEAKING: speaking,
    });
    expect(out.map((w) => w.section)).toEqual([
      "READING",
      "LISTENING",
      "VOCAB",
      "GRAMMAR",
      "WRITING",
      "SPEAKING",
    ]);
  });
});
