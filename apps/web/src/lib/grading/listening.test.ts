import { describe, expect, it } from "vitest";
import { gradeListening } from "./listening";
import type { ListeningPart } from "@/lib/audio/types";

const mcqPart1: ListeningPart = {
  partNumber: 1,
  kind: "MCQ_3_PICTURE",
  instructionZh: "...",
  previewSec: 5,
  playRule: "PER_ITEM",
  audioScript: [],
  questions: [
    {
      id: "q1", prompt: "Q1", type: "MCQ_3_PICTURE",
      options: [{ id: "A" }, { id: "B" }, { id: "C" }],
      answer: "A", explanationZh: "...", examPointId: "KET.L.Part1.gist",
    },
    {
      id: "q2", prompt: "Q2", type: "MCQ_3_PICTURE",
      options: [{ id: "A" }, { id: "B" }, { id: "C" }],
      answer: "B", explanationZh: "...", examPointId: "KET.L.Part1.gist",
    },
  ],
};

const gapFill: ListeningPart = {
  partNumber: 2,
  kind: "GAP_FILL_OPEN",
  instructionZh: "...",
  previewSec: 10,
  playRule: "PER_PART",
  audioScript: [],
  questions: [
    {
      id: "g1", prompt: "Name of secretary:", type: "GAP_FILL_OPEN",
      answer: "fairford", explanationZh: "...", examPointId: "KET.L.Part2.detail",
    },
    {
      id: "g2", prompt: "Day of return:", type: "GAP_FILL_OPEN",
      answer: "friday", explanationZh: "...", examPointId: "KET.L.Part2.detail",
    },
  ],
};

describe("gradeListening", () => {
  it("scores MCQ on exact option-id match", () => {
    const result = gradeListening([mcqPart1], { q1: "A", q2: "C" });
    expect(result.rawScore).toBe(1);
    expect(result.totalPossible).toBe(2);
    expect(result.perQuestion.q1.correct).toBe(true);
    expect(result.perQuestion.q2.correct).toBe(false);
  });

  it("gap-fill is case-insensitive after trim", () => {
    const result = gradeListening([gapFill], { g1: "  Fairford  ", g2: "FRIDAY" });
    expect(result.rawScore).toBe(2);
    expect(result.perQuestion.g1.correct).toBe(true);
    expect(result.perQuestion.g2.correct).toBe(true);
  });

  it("gap-fill rejects misspellings (divergence from Cambridge's lenient key)", () => {
    const result = gradeListening([gapFill], { g1: "fairfrod", g2: "fridy" });
    expect(result.rawScore).toBe(0);
  });

  it("missing answers score 0", () => {
    const result = gradeListening([mcqPart1], {});
    expect(result.rawScore).toBe(0);
  });

  it("computes weakPoints aggregating examPointId + difficultyPointId from wrong answers", () => {
    const result = gradeListening([mcqPart1], { q1: "B", q2: "A" }); // both wrong
    expect(result.weakPoints.examPoints).toEqual(["KET.L.Part1.gist"]);
  });
});
