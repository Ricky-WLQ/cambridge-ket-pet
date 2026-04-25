import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./edge-tts-client", () => ({
  synthesizeSegmentWithRetry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./concat", async (orig) => {
  const actual = await orig<typeof import("./concat")>();
  return {
    ...actual,
    generateSilenceMp3: vi.fn().mockResolvedValue(undefined),
    concatMp3s: vi.fn().mockResolvedValue(undefined),
    probeDurationMs: vi.fn().mockResolvedValue(1000),
  };
});
vi.mock("./r2-client", () => ({
  uploadAudioToR2: vi.fn().mockResolvedValue("listening/t1/audio.mp3"),
}));

import { generateListeningAudio } from "./generate";
import type { ListeningTestPayloadV2 } from "./types";

const trivialKetPart1Payload: ListeningTestPayloadV2 = {
  version: 2,
  examType: "KET",
  scope: "PART",
  part: 1,
  cefrLevel: "A2",
  generatedBy: "test",
  parts: [
    {
      partNumber: 1,
      kind: "MCQ_3_PICTURE",
      instructionZh: "...",
      previewSec: 5,
      playRule: "PER_ITEM",
      audioScript: [
        { id: "q1_stim", kind: "question_stimulus", voiceTag: "S1_male", text: "Hello.", questionId: "q1" },
      ],
      questions: [],
    },
  ],
};

describe("generateListeningAudio", () => {
  beforeEach(() => {
    process.env.R2_BUCKET = "test";
    process.env.R2_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.R2_ACCESS_KEY_ID = "k";
    process.env.R2_SECRET_ACCESS_KEY = "s";
  });

  it("returns r2Key + non-empty segments on success", async () => {
    const result = await generateListeningAudio({
      testId: "t1",
      payload: trivialKetPart1Payload,
      ratePercent: -5,
    });
    expect(result.r2Key).toBe("listening/t1/audio.mp3");
    expect(result.segments.length).toBeGreaterThan(0);
  });
});
