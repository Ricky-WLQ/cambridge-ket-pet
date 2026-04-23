import { describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));
vi.mock("ffmpeg-static", () => ({ default: "/path/to/ffmpeg" }));

import { probeDurationMs } from "./concat";

describe("probeDurationMs", () => {
  it("parses ffprobe duration output (e.g., '5.432')", async () => {
    execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
      cb(null, "5.432\n");
    });
    const ms = await probeDurationMs("/tmp/fake.mp3");
    expect(ms).toBe(5432);
  });

  it("rounds fractional ms", async () => {
    execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
      cb(null, "2.0017\n");
    });
    const ms = await probeDurationMs("/tmp/fake.mp3");
    expect(ms).toBe(2002);
  });
});

import type { ListeningPart } from "./types";
import { buildConcatPlan } from "./concat";
import { PAUSE_SEC } from "./constants";

describe("buildConcatPlan (PER_ITEM)", () => {
  it("duplicates each question's stimulus with repeat_cue + pauses between", () => {
    const part: ListeningPart = {
      partNumber: 1,
      kind: "MCQ_3_PICTURE",
      instructionZh: "...",
      previewSec: 5,
      playRule: "PER_ITEM",
      audioScript: [
        { id: "q1_num", kind: "question_number", voiceTag: "proctor", text: "Question 1" },
        { id: "q1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hello.", questionId: "q1" },
        { id: "q2_num", kind: "question_number", voiceTag: "proctor", text: "Question 2" },
        { id: "q2_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Bye.", questionId: "q2" },
      ],
      questions: [],
    };
    const plan = buildConcatPlan(part, "KET");

    // Expected: previewPause, q1_num, q1_stim, BEFORE_REPEAT, repeat_cue, BEFORE_REPEAT, q1_num, q1_stim, BETWEEN_ITEMS, q2_num, q2_stim, BEFORE_REPEAT, repeat_cue, BEFORE_REPEAT, q2_num, q2_stim, BETWEEN_ITEMS
    const kinds = plan.map((e) => e.kind);
    expect(kinds).toEqual([
      "preview_pause",
      "question_number", "question_stimulus",
      "pause",
      "repeat_cue",
      "pause",
      "question_number", "question_stimulus",
      "pause",
      "question_number", "question_stimulus",
      "pause",
      "repeat_cue",
      "pause",
      "question_number", "question_stimulus",
      "pause",
    ]);
    expect(plan[0].durationMs).toBe(5000); // preview 5s for KET Part 1
    expect(plan[3].durationMs).toBe(PAUSE_SEC.BEFORE_REPEAT * 1000);
    expect(plan[8].durationMs).toBe(PAUSE_SEC.BETWEEN_ITEMS * 1000);
  });
});

describe("buildConcatPlan (PER_PART)", () => {
  it("plays the whole part's stimuli twice with repeat cue between", () => {
    const part: ListeningPart = {
      partNumber: 3,
      kind: "MCQ_3_TEXT",
      instructionZh: "...",
      previewSec: 20,
      playRule: "PER_PART",
      audioScript: [
        { id: "stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hi.", questionId: "q1" },
      ],
      questions: [],
    };
    const plan = buildConcatPlan(part, "KET");
    const kinds = plan.map((e) => e.kind);
    expect(kinds).toEqual([
      "preview_pause",
      "question_stimulus",
      "pause",
      "repeat_cue",
      "pause",
      "question_stimulus",
    ]);
    expect(plan[0].durationMs).toBe(20000);
  });
});

import { buildFullPlan } from "./concat";
import type { ListeningTestPayloadV2 } from "./types";

describe("buildFullPlan", () => {
  it("wraps parts with opening rubric, part intros, inter-part pauses, and transfer block", () => {
    const payload: ListeningTestPayloadV2 = {
      version: 2,
      examType: "KET",
      scope: "FULL",
      cefrLevel: "A2",
      generatedBy: "test",
      parts: [
        {
          partNumber: 1,
          kind: "MCQ_3_PICTURE",
          instructionZh: "...",
          previewSec: 5,
          playRule: "PER_PART",
          audioScript: [
            { id: "p1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hi.", questionId: "q1" },
          ],
          questions: [],
        },
        {
          partNumber: 2,
          kind: "GAP_FILL_OPEN",
          instructionZh: "...",
          previewSec: 10,
          playRule: "PER_PART",
          audioScript: [
            { id: "p2_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Lecture.", questionId: "q6" },
          ],
          questions: [],
        },
      ],
    };

    const plan = buildFullPlan(payload);
    const kinds = plan.map((e) => e.kind);

    // Head: rubric, pause, part_intro
    expect(kinds[0]).toBe("rubric");
    expect(kinds[1]).toBe("pause");
    expect(kinds[2]).toBe("part_intro");

    // Contains part_end + inter-part pause + next part_intro
    const partEnds = kinds.filter((k) => k === "part_end");
    expect(partEnds.length).toBe(2); // 2 parts

    // Tail: transfer_start, long pause, transfer_one_min, pause, closing
    expect(kinds.slice(-5)).toEqual([
      "transfer_start",
      "pause",
      "transfer_one_min",
      "pause",
      "closing",
    ]);
  });
});
