import { describe, expect, it } from "vitest";
import { computeSegmentRecords } from "./segments";
import type { ConcatEntry } from "./segments";

describe("computeSegmentRecords", () => {
  it("computes sequential startMs/endMs for a flat concat list", () => {
    const entries: ConcatEntry[] = [
      { segment: { id: "a", kind: "rubric", voiceTag: "proctor" }, durationMs: 10000 },
      { segment: { id: "b", kind: "pause", voiceTag: null }, durationMs: 5000 },
      { segment: { id: "c", kind: "question_stimulus", voiceTag: "S1_male" }, durationMs: 8000 },
    ];
    const records = computeSegmentRecords(entries);

    expect(records).toHaveLength(3);
    expect(records[0].startMs).toBe(0);
    expect(records[0].endMs).toBe(10000);
    expect(records[1].startMs).toBe(10000);
    expect(records[1].endMs).toBe(15000);
    expect(records[2].startMs).toBe(15000);
    expect(records[2].endMs).toBe(23000);
  });

  it("collapses repeated segments (second pass of PER_ITEM/PER_PART play rule) to the same id but distinct records", () => {
    // A repeat pass duplicates a stimulus — record both passes with the same id
    const stim = { id: "q1_stim", kind: "question_stimulus" as const, voiceTag: "S1_male" as const, questionId: "q1" };
    const entries: ConcatEntry[] = [
      { segment: stim, durationMs: 5000 },
      { segment: { id: "repeat", kind: "repeat_cue", voiceTag: "proctor" }, durationMs: 2000 },
      { segment: stim, durationMs: 5000 }, // second play
    ];
    const records = computeSegmentRecords(entries);

    expect(records).toHaveLength(3);
    expect(records[0].id).toBe("q1_stim");
    expect(records[2].id).toBe("q1_stim");
    expect(records[0].questionId).toBe("q1");
    expect(records[2].questionId).toBe("q1");
    expect(records[0].startMs).toBe(0);
    expect(records[2].startMs).toBe(7000);
  });
});
