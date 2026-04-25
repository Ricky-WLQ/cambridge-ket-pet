import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../reply/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    testAttempt: { findUnique: vi.fn() },
    test: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/speaking/turn-buffer", () => ({
  appendTurn: vi.fn(),
  __resetAllBuffers: vi.fn(),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_AI_URL = "http://localhost:8001";
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

function makeReq(attemptId: string, body: any) {
  return new Request(`http://x/api/speaking/${attemptId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const stubAttempt = async () => {
  const { prisma } = await import("@/lib/prisma");
  (prisma.testAttempt.findUnique as any).mockResolvedValue({
    id: "attempt-1",
    userId: "user-1",
    testId: "test-1",
    speakingStatus: "IN_PROGRESS",
  });
  (prisma.test.findUnique as any).mockResolvedValue({
    id: "test-1",
    speakingPrompts: {
      level: "KET",
      initialGreeting: "Hi",
      parts: [
        { partNumber: 1, title: "Interview", targetMinutes: 3, examinerScript: ["What's your name?"], coachingHints: "", photoKey: null },
        { partNumber: 2, title: "Photo", targetMinutes: 5, examinerScript: ["Describe this photo."], coachingHints: "", photoKey: null },
      ],
    },
  });
};

describe("POST /api/speaking/[attemptId]/reply", () => {
  it("happy path: calls examiner, buffers the turn, returns structured reply", async () => {
    await stubAttempt();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        reply: "Where do you live?",
        advancePart: null,
        sessionEnd: false,
      }), { status: 200 }),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "My name is Li Wei." }],
      currentPart: 1,
      currentPartQuestionCount: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toBe("Where do you live?");
    expect(json.flags.advancePart).toBeNull();
    expect(json.flags.sessionEnd).toBe(false);

    // Cursor is forwarded to the Python examiner as snake_case.
    const callBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.current_part).toBe(1);
    expect(callBody.current_part_question_count).toBe(1);

    const { appendTurn } = await import("@/lib/speaking/turn-buffer");
    expect(appendTurn).toHaveBeenCalledWith("attempt-1", expect.objectContaining({
      userText: "My name is Li Wei.",
      replyText: "Where do you live?",
      partNumber: 1,
    }));
  });

  it("defaults currentPartQuestionCount to 0 when client omits it", async () => {
    await stubAttempt();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        reply: "What's your name?",
        advancePart: null,
        sessionEnd: false,
      }), { status: 200 }),
    );
    await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "hi" }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    const callBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(callBody.current_part_question_count).toBe(0);
  });

  it("passes advancePart from the examiner through", async () => {
    await stubAttempt();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({
        reply: "Now describe this photo.",
        advancePart: 2,
        sessionEnd: false,
      }), { status: 200 }),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "I live in Beijing." }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    const json = await res.json();
    expect(json.flags.advancePart).toBe(2);
  });

  it("returns a polite filler reply when the AI service times out", async () => {
    await stubAttempt();
    fetchMock.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5)),
    );
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "hi" }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reply).toMatch(/one moment|could you say/i);
    expect(json.flags.retry).toBe(true);
  });

  it("returns 409 when the attempt is not IN_PROGRESS", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "SUBMITTED",
    });
    const res = await POST(makeReq("attempt-1", {
      messages: [{ role: "user", content: "hi" }],
      currentPart: 1,
    }), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(409);
  });
});
