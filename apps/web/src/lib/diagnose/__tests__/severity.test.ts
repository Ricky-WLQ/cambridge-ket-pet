/**
 * Vitest suite for severity computation on KnowledgePointGroup[].
 *
 * Covers the boundary cases for computeSeverity (0/1/2/3/N), the immutability
 * contract for applySeverity / applySeverityToAll (input must remain
 * structurally identical after the call), and the sort order for
 * sortBySeverity (severity rank first, question count desc as tie-breaker,
 * stable for equal severity + equal count, plus the trivial empty / single
 * input cases).
 */

import { describe, expect, test } from "vitest";
import {
  applySeverity,
  applySeverityToAll,
  computeSeverity,
  sortBySeverity,
} from "../severity";
import type {
  KnowledgePointCategory,
  KnowledgePointGroup,
  KnowledgePointQuestion,
  KnowledgePointSeverity,
} from "../types";

// ─── builders ─────────────────────────────────────────────────────────────

function makeQuestion(i: number): KnowledgePointQuestion {
  return {
    section: "READING",
    questionText: `Q${i}`,
    userAnswer: "wrong",
    correctAnswer: "right",
    whyWrong: "n/a",
    rule: "n/a",
  };
}

function makeGroup(
  knowledgePoint: string,
  questionCount: number,
  options: {
    category?: KnowledgePointCategory;
    severity?: KnowledgePointSeverity;
  } = {},
): KnowledgePointGroup {
  return {
    knowledgePoint,
    category: options.category ?? "grammar",
    miniLesson: `Lesson for ${knowledgePoint}`,
    rule: `Rule for ${knowledgePoint}`,
    exampleSentences: [`Example ${knowledgePoint}`],
    questions: Array.from({ length: questionCount }, (_, i) => makeQuestion(i)),
    severity: options.severity ?? "minor", // placeholder; tests overwrite via applySeverity
  };
}

// ─── computeSeverity ──────────────────────────────────────────────────────

describe("computeSeverity", () => {
  test("0 questions → minor (defensive: empty cluster)", () => {
    expect(computeSeverity(0)).toBe("minor");
  });

  test("1 question → minor", () => {
    expect(computeSeverity(1)).toBe("minor");
  });

  test("2 questions → moderate", () => {
    expect(computeSeverity(2)).toBe("moderate");
  });

  test("3 questions → critical", () => {
    expect(computeSeverity(3)).toBe("critical");
  });

  test("10 questions → critical", () => {
    expect(computeSeverity(10)).toBe("critical");
  });

  test("negative count → minor (defensive)", () => {
    expect(computeSeverity(-1)).toBe("minor");
  });
});

// ─── applySeverity ────────────────────────────────────────────────────────

describe("applySeverity", () => {
  test("returns a new object with severity set; original is structurally unchanged", () => {
    const original = makeGroup("present continuous", 3, { severity: "minor" });
    const snapshot = JSON.parse(JSON.stringify(original));

    const result = applySeverity(original);

    // Returned object has the recomputed severity.
    expect(result.severity).toBe("critical");
    expect(result.knowledgePoint).toBe("present continuous");

    // Identity: a new object is returned (not the same reference).
    expect(result).not.toBe(original);

    // Immutability: original's deep value matches the snapshot taken before the call.
    expect(original).toEqual(snapshot);
    // And in particular the original's severity field was NOT touched.
    expect(original.severity).toBe("minor");
  });

  test("propagates moderate severity (2 questions)", () => {
    const g = makeGroup("definite article", 2);
    expect(applySeverity(g).severity).toBe("moderate");
  });

  test("propagates minor severity (0 questions)", () => {
    const g = makeGroup("empty edge case", 0);
    expect(applySeverity(g).severity).toBe("minor");
  });
});

// ─── applySeverityToAll ───────────────────────────────────────────────────

describe("applySeverityToAll", () => {
  test("computes severities for mixed-size groups and does NOT mutate input", () => {
    const input: KnowledgePointGroup[] = [
      makeGroup("kp1", 5, { severity: "minor" }), // → critical
      makeGroup("kp2", 2, { severity: "minor" }), // → moderate
      makeGroup("kp3", 1, { severity: "minor" }), // → minor
      makeGroup("kp4", 3, { severity: "minor" }), // → critical
      makeGroup("kp5", 0, { severity: "minor" }), // → minor
    ];
    const inputSnapshot = JSON.parse(JSON.stringify(input));

    const result = applySeverityToAll(input);

    expect(result.map((g) => g.severity)).toEqual([
      "critical",
      "moderate",
      "minor",
      "critical",
      "minor",
    ]);
    // Order preserved.
    expect(result.map((g) => g.knowledgePoint)).toEqual([
      "kp1",
      "kp2",
      "kp3",
      "kp4",
      "kp5",
    ]);

    // Immutability: input array reference unchanged structurally.
    expect(input).toEqual(inputSnapshot);
    // Input groups are NOT the same references as result groups.
    for (let i = 0; i < input.length; i++) {
      expect(result[i]).not.toBe(input[i]);
    }
  });

  test("empty input → empty output", () => {
    expect(applySeverityToAll([])).toEqual([]);
  });
});

// ─── sortBySeverity ───────────────────────────────────────────────────────

describe("sortBySeverity", () => {
  test("orders critical → moderate → minor and preserves input order within same severity", () => {
    const groups: KnowledgePointGroup[] = [
      makeGroup("minor-A", 1, { severity: "minor" }),
      makeGroup("moderate-A", 2, { severity: "moderate" }),
      makeGroup("critical-A", 3, { severity: "critical" }),
      makeGroup("moderate-B", 2, { severity: "moderate" }),
      makeGroup("minor-B", 1, { severity: "minor" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(groups));

    const result = sortBySeverity(groups);

    expect(result.map((g) => g.knowledgePoint)).toEqual([
      "critical-A",
      "moderate-A",
      "moderate-B",
      "minor-A",
      "minor-B",
    ]);

    // Immutability: input not mutated.
    expect(groups).toEqual(snapshot);
    expect(result).not.toBe(groups);
  });

  test("within same severity, higher question count comes first", () => {
    const groups: KnowledgePointGroup[] = [
      makeGroup("critical-3q", 3, { severity: "critical" }),
      makeGroup("critical-7q", 7, { severity: "critical" }),
      makeGroup("critical-5q", 5, { severity: "critical" }),
    ];

    const result = sortBySeverity(groups);

    expect(result.map((g) => g.knowledgePoint)).toEqual([
      "critical-7q",
      "critical-5q",
      "critical-3q",
    ]);
  });

  test("empty input → empty output", () => {
    expect(sortBySeverity([])).toEqual([]);
  });

  test("single group → unchanged 1-element array", () => {
    const only = makeGroup("only-one", 4, { severity: "critical" });
    const result = sortBySeverity([only]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(only);
  });
});
