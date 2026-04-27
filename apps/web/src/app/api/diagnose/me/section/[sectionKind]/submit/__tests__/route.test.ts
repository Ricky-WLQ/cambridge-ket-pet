/**
 * Tests for the wire-format normalization in the diagnose section submit
 * route (C1). The route accepts both the diagnose-native shape and the
 * runner-native shape for Reading/Listening/Writing answers, then
 * translates to the canonical persisted shape before grading.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const wdFindUnique = vi.fn();
const taFindUnique = vi.fn();
const taUpdate = vi.fn();
const wdUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyDiagnose: {
      findUnique: (...a: unknown[]) => wdFindUnique(...a),
      update: (...a: unknown[]) => wdUpdate(...a),
    },
    testAttempt: {
      findUnique: (...a: unknown[]) => taFindUnique(...a),
      update: (...a: unknown[]) => taUpdate(...a),
    },
  },
}));

const markComplete = vi.fn();
vi.mock("@/lib/diagnose/markComplete", () => ({
  maybeMarkDiagnoseComplete: (...a: unknown[]) => markComplete(...a),
}));

import { POST } from "../route";

beforeEach(() => {
  wdFindUnique.mockReset();
  taFindUnique.mockReset();
  taUpdate.mockReset();
  wdUpdate.mockReset();
  markComplete.mockReset();
  markComplete.mockImplementation(async () => undefined);
});

const params = (sectionKind: string) =>
  Promise.resolve({ sectionKind });

const reqWith = (body: unknown) =>
  new Request("http://t/api/diagnose/me/section/x/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const baseWdMock = {
  id: "wd-1",
  testId: "t-1",
  readingAttemptId: "at-r",
  listeningAttemptId: "at-l",
  writingAttemptId: "at-w",
  speakingAttemptId: "at-s",
  vocabAttemptId: "at-v",
  grammarAttemptId: "at-g",
  test: {
    kind: "DIAGNOSE",
    payload: {
      examType: "KET",
      sections: {
        READING: {
          passage: null,
          questions: [
            {
              id: "rq1",
              text: "Q1",
              options: ["o0", "o1", "o2"],
              correctIndex: 1,
            },
            {
              id: "rq2",
              text: "Q2",
              options: ["o0", "o1", "o2"],
              correctIndex: 0,
            },
          ],
          timeLimitSec: 480,
        },
        LISTENING: {
          parts: [
            {
              partNumber: 1,
              partType: "MCQ",
              audioStartSec: 0,
              audioEndSec: 0,
              questions: [
                {
                  id: "lq1",
                  text: "L1",
                  options: ["o0", "o1"],
                  correctIndex: 1,
                },
                {
                  id: "lq2",
                  text: "L2",
                  options: ["o0", "o1"],
                  correctIndex: 0,
                },
              ],
            },
          ],
          timeLimitSec: 600,
        },
        WRITING: {
          taskType: "EMAIL",
          prompt: "Write an email",
          contentPoints: [],
          minWords: 25,
          timeLimitSec: 900,
        },
      },
    },
  },
};

describe("C1: section submit wire-format normalization", () => {
  describe("READING", () => {
    it("accepts diagnose-native positional shape", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-r",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      const res = await POST(reqWith({ answers: { answers: [1, 0] } }), {
        params: params("READING"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("GRADED");
      // Both answers correct (1 and 0 match correctIndex)
      expect(body.scaledScore).toBe(100);
    });

    it("accepts runner-native letter-keyed record (translates to indexes)", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-r",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      // {rq1: "B", rq2: "A"} → indexes [1, 0] — both correct
      const res = await POST(
        reqWith({ answers: { rq1: "B", rq2: "A" } }),
        { params: params("READING") },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("GRADED");
      expect(body.scaledScore).toBe(100);
    });

    it("treats missing letter keys as null (unanswered)", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-r",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      // Only rq1 answered correctly → 1/2 → 50
      const res = await POST(reqWith({ answers: { rq1: "B" } }), {
        params: params("READING"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.scaledScore).toBe(50);
    });

    it("rejects malformed shapes", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-r",
        userId: "user-1",
        status: "IN_PROGRESS",
      });

      const res = await POST(reqWith({ answers: 42 }), {
        params: params("READING"),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("LISTENING", () => {
    it("accepts diagnose-native positional shape", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-l",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      const res = await POST(reqWith({ answers: { answers: [1, 0] } }), {
        params: params("LISTENING"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.scaledScore).toBe(100);
    });

    it("accepts runner-native letter-keyed record (flat across parts)", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-l",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      // {lq1: "B", lq2: "A"} → flat indexes [1, 0] both correct
      const res = await POST(
        reqWith({ answers: { lq1: "B", lq2: "A" } }),
        { params: params("LISTENING") },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.scaledScore).toBe(100);
    });
  });

  describe("WRITING", () => {
    it("accepts diagnose-native { text } shape", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-w",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      const res = await POST(reqWith({ answers: { text: "Hello world" } }), {
        params: params("WRITING"),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("SUBMITTED");
      // The persisted answers should have text="Hello world"
      const persisted = taUpdate.mock.calls.find(
        (c) => (c[0] as { where: { id: string } }).where.id === "at-w",
      );
      expect(persisted).toBeDefined();
      expect(
        (persisted![0] as { data: { answers: { text: string } } }).data.answers
          .text,
      ).toBe("Hello world");
    });

    it("accepts runner-native { response, chosenOption? } shape", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-w",
        userId: "user-1",
        status: "IN_PROGRESS",
      });
      taUpdate.mockResolvedValue({});
      wdUpdate.mockResolvedValue({});

      const res = await POST(
        reqWith({
          answers: { response: "Dear sir,", chosenOption: "A" },
        }),
        { params: params("WRITING") },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("SUBMITTED");
      const persisted = taUpdate.mock.calls.find(
        (c) => (c[0] as { where: { id: string } }).where.id === "at-w",
      );
      // response → text in persisted shape
      expect(
        (persisted![0] as { data: { answers: { text: string } } }).data.answers
          .text,
      ).toBe("Dear sir,");
    });

    it("rejects malformed writing body", async () => {
      wdFindUnique.mockResolvedValue(baseWdMock);
      taFindUnique.mockResolvedValue({
        id: "at-w",
        userId: "user-1",
        status: "IN_PROGRESS",
      });

      const res = await POST(reqWith({ answers: { foo: "bar" } }), {
        params: params("WRITING"),
      });
      expect(res.status).toBe(400);
    });
  });
});
