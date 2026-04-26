/**
 * Tests for the diagnose-payload transformation in the listening status
 * route (C5). When Test.kind === "DIAGNOSE", the route adapts the parent
 * DiagnosePayload into the ListeningTestPayloadV2 shape the runner expects.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    test: {
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));

import { GET } from "../route";

beforeEach(() => {
  findUnique.mockReset();
});

const params = (testId: string) =>
  Promise.resolve({ testId });

const reqWith = () =>
  new Request("http://t/api/listening/tests/x/status", { method: "GET" });

describe("C5: GET /api/listening/tests/[testId]/status — diagnose payload transform", () => {
  it("passes regular LISTENING test payload through unchanged", async () => {
    const v2Payload = {
      version: 2,
      examType: "KET",
      scope: "FULL",
      parts: [
        {
          partNumber: 1,
          kind: "MCQ_3_TEXT",
          instructionZh: "听并选择",
          previewSec: 10,
          playRule: "PER_PART",
          audioScript: [],
          questions: [
            {
              id: "q1",
              prompt: "What did the boy buy?",
              type: "MCQ_3_TEXT",
              options: [{ id: "A", text: "apple" }],
              answer: "A",
              explanationZh: "",
              examPointId: "",
            },
          ],
        },
      ],
      cefrLevel: "A2",
      generatedBy: "stub",
    };
    findUnique.mockResolvedValue({
      id: "test-1",
      userId: "user-1",
      kind: "LISTENING",
      payload: v2Payload,
      audioStatus: "READY",
      audioR2Key: "key.mp3",
      audioSegments: [],
      audioErrorMessage: null,
      audioGenStartedAt: new Date(),
    });
    const res = await GET(reqWith(), { params: params("test-1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload).toEqual(v2Payload);
  });

  it("transforms DIAGNOSE payload into V2 shape (parts + questions)", async () => {
    const diagnosePayload = {
      examType: "PET",
      sections: {
        LISTENING: {
          parts: [
            {
              partNumber: 1,
              partType: "MCQ_3_TEXT",
              audioStartSec: 0,
              audioEndSec: 60,
              questions: [
                {
                  id: "lq1",
                  text: "What did the boy buy?",
                  options: ["apple", "banana", "cherry"],
                  correctIndex: 1,
                },
              ],
            },
          ],
          timeLimitSec: 600,
        },
      },
    };
    findUnique.mockResolvedValue({
      id: "test-1",
      userId: "user-1",
      kind: "DIAGNOSE",
      payload: diagnosePayload,
      audioStatus: "READY",
      audioR2Key: "key.mp3",
      audioSegments: [],
      audioErrorMessage: null,
      audioGenStartedAt: new Date(),
    });
    const res = await GET(reqWith(), { params: params("test-1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.version).toBe(2);
    expect(body.payload.examType).toBe("PET");
    expect(body.payload.cefrLevel).toBe("B1");
    expect(body.payload.parts).toHaveLength(1);
    const p = body.payload.parts[0];
    expect(p.partNumber).toBe(1);
    expect(p.kind).toBe("MCQ_3_TEXT");
    expect(p.instructionZh).toMatch(/听|音频/); // Chinese instruction filled in
    expect(p.questions).toHaveLength(1);
    const q = p.questions[0];
    expect(q.id).toBe("lq1");
    expect(q.prompt).toBe("What did the boy buy?");
    expect(q.type).toBe("MCQ_3_TEXT");
    // string[] options → { id: "A"|"B"|..., text }[]
    expect(q.options).toEqual([
      { id: "A", text: "apple" },
      { id: "B", text: "banana" },
      { id: "C", text: "cherry" },
    ]);
    // correctIndex 1 → answer "B"
    expect(q.answer).toBe("B");
  });

  it("does not return payload when audio is not READY", async () => {
    findUnique.mockResolvedValue({
      id: "test-1",
      userId: "user-1",
      kind: "DIAGNOSE",
      payload: { sections: { LISTENING: { parts: [] } } },
      audioStatus: "GENERATING",
      audioR2Key: null,
      audioSegments: [],
      audioErrorMessage: null,
      audioGenStartedAt: new Date(),
    });
    const res = await GET(reqWith(), { params: params("test-1") });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload).toBeUndefined();
    expect(body.audioReady).toBe(false);
  });

  it("returns 404 for non-owner test", async () => {
    findUnique.mockResolvedValue({
      id: "test-1",
      userId: "other-user",
      kind: "DIAGNOSE",
      payload: {},
      audioStatus: "READY",
      audioR2Key: "k",
      audioSegments: [],
      audioErrorMessage: null,
      audioGenStartedAt: null,
    });
    const res = await GET(reqWith(), { params: params("test-1") });
    expect(res.status).toBe(404);
  });
});
