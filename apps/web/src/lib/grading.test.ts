import { describe, test, expect } from "vitest";
import {
  type GradableQuestion,
  gradeReading,
  isAnswerCorrect,
  normalizeText,
} from "./grading";

const mcq = (id: string, answer: string, ep: string, dp: string | null = null): GradableQuestion => ({
  id,
  type: "MCQ",
  answer,
  exam_point_id: ep,
  difficulty_point_id: dp,
});

const cloze = (id: string, answer: string): GradableQuestion => ({
  id,
  type: "OPEN_CLOZE",
  answer,
  exam_point_id: "KET.RW.P2",
  difficulty_point_id: null,
});

const matching = (id: string, answer: string): GradableQuestion => ({
  id,
  type: "MATCHING",
  answer,
  exam_point_id: "KET.RW.P1",
  difficulty_point_id: null,
});

// ==================== normalizeText ====================
describe("normalizeText", () => {
  test("lowercases", () => {
    expect(normalizeText("Hello")).toBe("hello");
  });
  test("trims whitespace", () => {
    expect(normalizeText("  hi  ")).toBe("hi");
  });
  test("collapses internal whitespace", () => {
    expect(normalizeText("a   b")).toBe("a b");
  });
  test("strips common punctuation", () => {
    expect(normalizeText("don't")).toBe("dont");
    expect(normalizeText("hello,world.")).toBe("helloworld");
  });
});

// ==================== isAnswerCorrect ====================
describe("isAnswerCorrect - letter-based types", () => {
  test("MCQ correct letter (exact)", () => {
    expect(isAnswerCorrect(mcq("q1", "B", "X"), "B")).toBe(true);
  });
  test("MCQ correct letter (case-insensitive)", () => {
    expect(isAnswerCorrect(mcq("q1", "B", "X"), "b")).toBe(true);
  });
  test("MCQ wrong letter", () => {
    expect(isAnswerCorrect(mcq("q1", "B", "X"), "A")).toBe(false);
  });
  test("MATCHING correct letter", () => {
    expect(isAnswerCorrect(matching("q1", "F"), "f")).toBe(true);
  });
  test("blank answer is incorrect", () => {
    expect(isAnswerCorrect(mcq("q1", "B", "X"), "")).toBe(false);
    expect(isAnswerCorrect(mcq("q1", "B", "X"), "   ")).toBe(false);
  });
});

describe("isAnswerCorrect - OPEN_CLOZE word matching", () => {
  test("exact match", () => {
    expect(isAnswerCorrect(cloze("q1", "to"), "to")).toBe(true);
  });
  test("case-insensitive", () => {
    expect(isAnswerCorrect(cloze("q1", "To"), "TO")).toBe(true);
  });
  test("punctuation stripped both sides", () => {
    expect(isAnswerCorrect(cloze("q1", "don't"), "dont")).toBe(true);
  });
  test("wrong word", () => {
    expect(isAnswerCorrect(cloze("q1", "to"), "for")).toBe(false);
  });
  test("blank is incorrect", () => {
    expect(isAnswerCorrect(cloze("q1", "to"), "")).toBe(false);
  });
});

// ==================== gradeReading aggregation ====================
describe("gradeReading", () => {
  const Q = [
    mcq("q1", "B", "KET.RW.P3", "collocations"),
    mcq("q2", "A", "KET.RW.P3", "articles"),
    mcq("q3", "C", "KET.RW.P3"), // no difficulty point
  ];

  test("all correct -> 100%, no weak points", () => {
    const result = gradeReading(Q, { q1: "B", q2: "A", q3: "C" });
    expect(result.rawScore).toBe(3);
    expect(result.totalPossible).toBe(3);
    expect(result.scaledScore).toBe(100);
    expect(result.weakPoints.examPoints).toEqual([]);
    expect(result.weakPoints.difficultyPoints).toEqual([]);
  });

  test("all wrong -> 0%", () => {
    const result = gradeReading(Q, { q1: "A", q2: "B", q3: "A" });
    expect(result.rawScore).toBe(0);
    expect(result.scaledScore).toBe(0);
  });

  test("per-question breakdown includes user answer and correct answer", () => {
    const result = gradeReading(Q, { q1: "B", q2: "C" });
    const q1 = result.perQuestion.find((p) => p.id === "q1");
    const q2 = result.perQuestion.find((p) => p.id === "q2");
    expect(q1).toEqual({
      id: "q1",
      isCorrect: true,
      userAnswer: "B",
      correctAnswer: "B",
    });
    expect(q2).toEqual({
      id: "q2",
      isCorrect: false,
      userAnswer: "C",
      correctAnswer: "A",
    });
  });

  test("missing answer counts as wrong", () => {
    const result = gradeReading(Q, { q1: "B" }); // only q1 answered
    expect(result.rawScore).toBe(1);
    expect(result.totalPossible).toBe(3);
  });

  test("aggregates weak points by exam_point_id", () => {
    const result = gradeReading(Q, { q1: "A", q2: "B", q3: "C" });
    // q1 wrong, q2 wrong, q3 correct — 2 errors both on KET.RW.P3
    expect(result.weakPoints.examPoints).toEqual([
      { id: "KET.RW.P3", errorCount: 2 },
    ]);
  });

  test("aggregates weak points by difficulty_point_id, null ids excluded", () => {
    const result = gradeReading(Q, { q1: "A", q2: "B", q3: "A" });
    // q1 wrong (collocations), q2 wrong (articles), q3 wrong (null) - 3 errors
    const dp = result.weakPoints.difficultyPoints;
    expect(dp.find((d) => d.id === "collocations")?.errorCount).toBe(1);
    expect(dp.find((d) => d.id === "articles")?.errorCount).toBe(1);
    expect(dp.some((d) => d.id === null || d.id === "")).toBe(false);
    expect(dp).toHaveLength(2);
  });

  test("top-3 cap on weak-point lists", () => {
    const Qmany: GradableQuestion[] = [
      mcq("q1", "A", "EP1"),
      mcq("q2", "A", "EP2"),
      mcq("q3", "A", "EP3"),
      mcq("q4", "A", "EP4"),
      mcq("q5", "A", "EP5"),
    ];
    const allWrong = { q1: "B", q2: "B", q3: "B", q4: "B", q5: "B" };
    const result = gradeReading(Qmany, allWrong);
    expect(result.weakPoints.examPoints).toHaveLength(3);
  });

  test("rounds scaledScore to nearest integer", () => {
    const Q6: GradableQuestion[] = [
      mcq("q1", "A", "X"),
      mcq("q2", "A", "X"),
      mcq("q3", "A", "X"),
      mcq("q4", "A", "X"),
      mcq("q5", "A", "X"),
      mcq("q6", "A", "X"),
    ];
    // 4/6 correct = 66.666…% -> 67
    const result = gradeReading(Q6, {
      q1: "A",
      q2: "A",
      q3: "A",
      q4: "A",
      q5: "B",
      q6: "B",
    });
    expect(result.rawScore).toBe(4);
    expect(result.scaledScore).toBe(67);
  });
});
