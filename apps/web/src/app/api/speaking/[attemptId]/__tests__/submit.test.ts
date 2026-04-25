import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../submit/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    testAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    },
    test: {
      findUnique: vi.fn(async () => ({ id: "t", speakingPersona: "KET" })),
    },
  },
}));
vi.mock("@/lib/speaking/akool-client", () => ({
  closeAkoolSession: vi.fn(async () => {}),
}));
vi.mock("@/lib/speaking/turn-buffer", () => ({
  readTurns: vi.fn(),
  clearTurns: vi.fn(),
  __resetAllBuffers: vi.fn(),
}));
vi.mock("@/lib/speaking/scoring-client", () => ({
  scoreSpeakingAttempt: vi.fn(async () => ({
    grammarVocab: 3,
    discourseManagement: 3,
    pronunciation: 3,
    interactive: 3,
    overall: 3.0,
    justification: "ok",
    weakPoints: [],
  })),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

function makeReq(id: string, body: any) {
  return new Request(`http://x/api/speaking/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/speaking/[attemptId]/submit", () => {
  it("idempotent: returns ok when already past IN_PROGRESS", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t", speakingStatus: "SCORED",
    });
    const res = await POST(
      makeReq("attempt-1", {}),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    // No transcript/update work should have happened.
    expect(prisma.testAttempt.update).not.toHaveBeenCalled();
  });

  it("happy path: reconciles transcript, closes Akool, persists SUBMITTED", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
    ]);

    const res = await POST(
      makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const { closeAkoolSession } = await import("@/lib/speaking/akool-client");
    expect(closeAkoolSession).toHaveBeenCalledWith("sess-1");
    // First update must be the SUBMITTED transition with the reconciled
    // transcript; scoring happens asynchronously after we return.
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.speakingStatus).toBe("SUBMITTED");
    // Mirror onto AttemptStatus so legacy filters/aggregates pick up the attempt.
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.status).toBe("SUBMITTED");
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.transcript).toBeTruthy();

    const { clearTurns } = await import("@/lib/speaking/turn-buffer");
    expect(clearTurns).toHaveBeenCalledWith("attempt-1");
  });

  it("FAILED when both server + client transcripts are empty", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([]);

    const res = await POST(
      makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.speakingStatus).toBe("FAILED");
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.status).toBe("ABANDONED");
    expect((prisma.testAttempt.update as any).mock.calls[0][0].data.speakingError).toBe("No transcript captured");
  });
});
