/**
 * Vitest suite for the deterministic per-section graders. The 4 graders are
 * pure functions over the diagnose-native content + answer shapes; we cover
 * the full-correct / full-wrong / partial / null / empty matrix per section,
 * the special string normalization rules for Vocab, the rounding rule for
 * scaledScore, the perItem.correctAnswer = option text invariant, and the
 * empty-section edge case (totalPossible=0 must yield scaledScore=0, not NaN).
 */

import { describe, expect, test } from "vitest";
import {
  gradeGrammarSection,
  gradeListeningSection,
  gradeReadingSection,
  gradeVocabSection,
} from "../grade";
import type {
  DiagnoseGrammarContent,
  DiagnoseListeningContent,
  DiagnoseReadingContent,
  DiagnoseVocabContent,
  GrammarAnswers,
  ListeningAnswers,
  ReadingAnswers,
  VocabAnswers,
} from "../types";

// ─── builders ─────────────────────────────────────────────────────────────

function readingContent(
  questions: { id: string; options: string[]; correctIndex: number }[],
): DiagnoseReadingContent {
  return {
    passage: "irrelevant for grading",
    questions: questions.map((q) => ({
      id: q.id,
      text: `Q ${q.id}`,
      options: q.options,
      correctIndex: q.correctIndex,
    })),
    timeLimitSec: 480,
  };
}

function readingAnswers(answers: (number | null)[]): ReadingAnswers {
  return { sectionKind: "READING", answers };
}

function listeningContent(
  parts: {
    partNumber: number;
    questions: { id: string; options: string[]; correctIndex: number }[];
  }[],
): DiagnoseListeningContent {
  return {
    parts: parts.map((p) => ({
      partNumber: p.partNumber,
      partType: "MCQ",
      audioStartSec: 0,
      audioEndSec: 30,
      questions: p.questions.map((q) => ({
        id: q.id,
        text: `Q ${q.id}`,
        options: q.options,
        correctIndex: q.correctIndex,
      })),
    })),
    timeLimitSec: 600,
  };
}

function listeningAnswers(answers: (number | null)[]): ListeningAnswers {
  return { sectionKind: "LISTENING", answers };
}

function vocabContent(
  items: { wordId: string; word: string; pattern?: string }[],
): DiagnoseVocabContent {
  return {
    items: items.map((it) => ({
      wordId: it.wordId,
      word: it.word,
      fillPattern: it.pattern ?? `____ is ${it.word}`,
    })),
    timeLimitSec: 240,
  };
}

function vocabAnswers(answers: (string | null)[]): VocabAnswers {
  return { sectionKind: "VOCAB", answers };
}

function grammarContent(
  items: { questionId: string; options: string[]; correctIndex: number }[],
): DiagnoseGrammarContent {
  return {
    questions: items.map((it) => ({
      questionId: it.questionId,
      topicId: "topic-x",
      questionText: `Q ${it.questionId}`,
      options: it.options,
      correctIndex: it.correctIndex,
    })),
    timeLimitSec: 300,
  };
}

function grammarAnswers(answers: (number | null)[]): GrammarAnswers {
  return { sectionKind: "GRAMMAR", answers };
}

// ─── Reading ──────────────────────────────────────────────────────────────

describe("gradeReadingSection", () => {
  const content = readingContent([
    { id: "r1", options: ["a", "b", "c"], correctIndex: 1 }, // b
    { id: "r2", options: ["x", "y"], correctIndex: 0 }, // x
    { id: "r3", options: ["p", "q", "r", "s"], correctIndex: 3 }, // s
  ]);

  test("all correct → 100%", () => {
    const r = gradeReadingSection(content, readingAnswers([1, 0, 3]));
    expect(r.rawScore).toBe(3);
    expect(r.totalPossible).toBe(3);
    expect(r.scaledScore).toBe(100);
    expect(r.perItem.every((p) => p.isCorrect)).toBe(true);
  });

  test("all wrong → 0%", () => {
    const r = gradeReadingSection(content, readingAnswers([0, 1, 0]));
    expect(r.rawScore).toBe(0);
    expect(r.scaledScore).toBe(0);
    expect(r.perItem.every((p) => !p.isCorrect)).toBe(true);
  });

  test("partial (2/3) → 67", () => {
    const r = gradeReadingSection(content, readingAnswers([1, 0, 0]));
    expect(r.rawScore).toBe(2);
    expect(r.scaledScore).toBe(67);
  });

  test("null answers count as wrong; correctAnswer is option TEXT not index", () => {
    const r = gradeReadingSection(content, readingAnswers([null, null, 3]));
    expect(r.rawScore).toBe(1);
    expect(r.perItem[0]).toEqual({
      questionId: "r1",
      isCorrect: false,
      userAnswer: null,
      correctAnswer: "b",
    });
    expect(r.perItem[2]).toEqual({
      questionId: "r3",
      isCorrect: true,
      userAnswer: "s",
      correctAnswer: "s",
    });
  });

  test("empty answers array (shorter than questions) → all unanswered = wrong", () => {
    const r = gradeReadingSection(content, readingAnswers([]));
    expect(r.rawScore).toBe(0);
    expect(r.totalPossible).toBe(3);
    expect(r.perItem).toHaveLength(3);
    expect(r.perItem.every((p) => p.userAnswer === null)).toBe(true);
  });

  test("totalPossible 0 → scaledScore 0 (no NaN)", () => {
    const r = gradeReadingSection(readingContent([]), readingAnswers([]));
    expect(r.rawScore).toBe(0);
    expect(r.totalPossible).toBe(0);
    expect(r.scaledScore).toBe(0);
    expect(Number.isNaN(r.scaledScore)).toBe(false);
  });
});

// ─── Listening ────────────────────────────────────────────────────────────

describe("gradeListeningSection", () => {
  // 2 parts × 2 questions = 4 items, to verify flattening order.
  const content = listeningContent([
    {
      partNumber: 1,
      questions: [
        { id: "L1.1", options: ["a", "b"], correctIndex: 0 },
        { id: "L1.2", options: ["c", "d"], correctIndex: 1 },
      ],
    },
    {
      partNumber: 2,
      questions: [
        { id: "L2.1", options: ["e", "f"], correctIndex: 1 },
        { id: "L2.2", options: ["g", "h"], correctIndex: 0 },
      ],
    },
  ]);

  test("all correct (4/4) → 100%, flattening preserves order", () => {
    const r = gradeListeningSection(content, listeningAnswers([0, 1, 1, 0]));
    expect(r.rawScore).toBe(4);
    expect(r.totalPossible).toBe(4);
    expect(r.scaledScore).toBe(100);
    expect(r.perItem.map((p) => p.questionId)).toEqual([
      "L1.1",
      "L1.2",
      "L2.1",
      "L2.2",
    ]);
  });

  test("all wrong → 0%", () => {
    const r = gradeListeningSection(content, listeningAnswers([1, 0, 0, 1]));
    expect(r.rawScore).toBe(0);
    expect(r.scaledScore).toBe(0);
  });

  test("partial 2/4 → 50%", () => {
    // Part 1 right (a, d), part 2 wrong.
    const r = gradeListeningSection(content, listeningAnswers([0, 1, 0, 1]));
    expect(r.rawScore).toBe(2);
    expect(r.scaledScore).toBe(50);
  });

  test("null answer counts as wrong; correctAnswer is the option text", () => {
    const r = gradeListeningSection(
      content,
      listeningAnswers([null, 1, null, 0]),
    );
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0]).toEqual({
      questionId: "L1.1",
      isCorrect: false,
      userAnswer: null,
      correctAnswer: "a",
    });
    expect(r.perItem[2]).toEqual({
      questionId: "L2.1",
      isCorrect: false,
      userAnswer: null,
      correctAnswer: "f",
    });
  });

  test("empty answers array → all unanswered = wrong", () => {
    const r = gradeListeningSection(content, listeningAnswers([]));
    expect(r.rawScore).toBe(0);
    expect(r.totalPossible).toBe(4);
  });
});

// ─── Vocab ────────────────────────────────────────────────────────────────

describe("gradeVocabSection", () => {
  const content = vocabContent([
    { wordId: "w1", word: "book" },
    { wordId: "w2", word: "house" },
    { wordId: "w3", word: "apple" },
  ]);

  test("exact match correct", () => {
    const r = gradeVocabSection(
      content,
      vocabAnswers(["book", "house", "apple"]),
    );
    expect(r.rawScore).toBe(3);
    expect(r.scaledScore).toBe(100);
  });

  test("case-insensitive (Book vs book)", () => {
    const r = gradeVocabSection(
      content,
      vocabAnswers(["Book", "HOUSE", "Apple"]),
    );
    expect(r.rawScore).toBe(3);
  });

  test("leading/trailing whitespace stripped", () => {
    const r = gradeVocabSection(
      content,
      vocabAnswers(["  book  ", "\thouse\n", " apple"]),
    );
    expect(r.rawScore).toBe(3);
  });

  test("null answer is wrong", () => {
    const r = gradeVocabSection(
      content,
      vocabAnswers([null, "house", "apple"]),
    );
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0].isCorrect).toBe(false);
    expect(r.perItem[0].userAnswer).toBeNull();
  });

  test("empty string is wrong", () => {
    const r = gradeVocabSection(content, vocabAnswers(["", "house", "apple"]));
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0].isCorrect).toBe(false);
  });

  test("punctuation NOT auto-stripped (book. !== book)", () => {
    const r = gradeVocabSection(
      content,
      vocabAnswers(["book.", "house", "apple"]),
    );
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0].isCorrect).toBe(false);
  });

  test("perItem.correctAnswer is the word itself", () => {
    const r = gradeVocabSection(content, vocabAnswers(["wrong", null, ""]));
    expect(r.perItem[0].correctAnswer).toBe("book");
    expect(r.perItem[1].correctAnswer).toBe("house");
    expect(r.perItem[2].correctAnswer).toBe("apple");
  });

  test("totalPossible 0 → scaledScore 0", () => {
    const r = gradeVocabSection(vocabContent([]), vocabAnswers([]));
    expect(r.scaledScore).toBe(0);
    expect(Number.isNaN(r.scaledScore)).toBe(false);
  });
});

// ─── Grammar ──────────────────────────────────────────────────────────────

describe("gradeGrammarSection", () => {
  const content = grammarContent([
    { questionId: "g1", options: ["am", "is", "are"], correctIndex: 1 }, // is
    { questionId: "g2", options: ["go", "goes", "going"], correctIndex: 0 }, // go
    { questionId: "g3", options: ["a", "an", "the"], correctIndex: 2 }, // the
  ]);

  test("all correct", () => {
    const r = gradeGrammarSection(content, grammarAnswers([1, 0, 2]));
    expect(r.rawScore).toBe(3);
    expect(r.scaledScore).toBe(100);
  });

  test("wrong index", () => {
    const r = gradeGrammarSection(content, grammarAnswers([0, 1, 1]));
    expect(r.rawScore).toBe(0);
    expect(r.perItem[0].isCorrect).toBe(false);
    expect(r.perItem[0].userAnswer).toBe("am");
  });

  test("null is wrong", () => {
    const r = gradeGrammarSection(content, grammarAnswers([null, 0, 2]));
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0].isCorrect).toBe(false);
    expect(r.perItem[0].userAnswer).toBeNull();
  });

  test("out-of-range index (99) → wrong, userAnswer falls back to <invalid>", () => {
    const r = gradeGrammarSection(content, grammarAnswers([99, 0, 2]));
    expect(r.rawScore).toBe(2);
    expect(r.perItem[0].isCorrect).toBe(false);
    expect(r.perItem[0].userAnswer).toBe("<invalid>");
  });

  test("perItem.correctAnswer is the option TEXT not index", () => {
    const r = gradeGrammarSection(content, grammarAnswers([null, null, null]));
    expect(r.perItem[0].correctAnswer).toBe("is");
    expect(r.perItem[1].correctAnswer).toBe("go");
    expect(r.perItem[2].correctAnswer).toBe("the");
  });
});

// ─── Cross-cutting: scaledScore rounding ──────────────────────────────────

describe("scaledScore rounding (Math.round)", () => {
  test("1/3 → 33", () => {
    const c = readingContent([
      { id: "a", options: ["x", "y"], correctIndex: 0 },
      { id: "b", options: ["x", "y"], correctIndex: 0 },
      { id: "c", options: ["x", "y"], correctIndex: 0 },
    ]);
    const r = gradeReadingSection(c, readingAnswers([0, 1, 1]));
    expect(r.rawScore).toBe(1);
    expect(r.scaledScore).toBe(33);
  });

  test("2/3 → 67", () => {
    const c = readingContent([
      { id: "a", options: ["x", "y"], correctIndex: 0 },
      { id: "b", options: ["x", "y"], correctIndex: 0 },
      { id: "c", options: ["x", "y"], correctIndex: 0 },
    ]);
    const r = gradeReadingSection(c, readingAnswers([0, 0, 1]));
    expect(r.rawScore).toBe(2);
    expect(r.scaledScore).toBe(67);
  });

  test("1/6 → 17", () => {
    const c = readingContent(
      Array.from({ length: 6 }, (_, i) => ({
        id: `q${i}`,
        options: ["x", "y"],
        correctIndex: 0,
      })),
    );
    const r = gradeReadingSection(c, readingAnswers([0, 1, 1, 1, 1, 1]));
    expect(r.rawScore).toBe(1);
    // 1/6 = 16.666… → Math.round → 17
    expect(r.scaledScore).toBe(17);
  });
});
