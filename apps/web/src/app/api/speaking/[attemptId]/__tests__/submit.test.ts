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
      // Default: non-diagnose test (kind=READING with no weeklyDiagnose
      // back-relation). Tests that exercise the diagnose mirror should
      // override this mock to return { kind: "DIAGNOSE", weeklyDiagnose: { id } }.
      findUnique: vi.fn(async () => ({
        id: "t",
        speakingPersona: "KET",
        kind: "READING",
        weeklyDiagnose: null,
      })),
    },
    weeklyDiagnose: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
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

beforeEach(async () => {
  vi.clearAllMocks();
  // ``vi.clearAllMocks`` resets call history but NOT mock implementations
  // — re-set the default ``prisma.test.findUnique`` so per-test overrides
  // (e.g., kind=DIAGNOSE) do not leak between tests.
  const { prisma } = await import("@/lib/prisma");
  (prisma.test.findUnique as any).mockResolvedValue({
    id: "t",
    speakingPersona: "KET",
    kind: "READING",
    weeklyDiagnose: null,
  });
});
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

  it("diagnose mirror: SUBMITTED flips WeeklyDiagnose.speakingStatus", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    // Override to a DIAGNOSE test linked to a WeeklyDiagnose.
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t",
      speakingPersona: "KET",
      kind: "DIAGNOSE",
      weeklyDiagnose: { id: "wd-1" },
    });
    // maybeMarkDiagnoseComplete reads WeeklyDiagnose to decide whether
    // to flip to COMPLETE — return a row with five sections done so the
    // gate is just waiting on speaking, then verify that adding speaking
    // triggers the COMPLETE update.
    (prisma.weeklyDiagnose.findUnique as any).mockResolvedValue({
      readingStatus: "GRADED",
      listeningStatus: "GRADED",
      writingStatus: "SUBMITTED",
      speakingStatus: "SUBMITTED",
      vocabStatus: "GRADED",
      grammarStatus: "GRADED",
      status: "PENDING",
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

    // The mirror should have been called: WeeklyDiagnose.update with
    // speakingStatus=SUBMITTED, then with status=COMPLETE.
    const wdUpdateCalls = (prisma.weeklyDiagnose.update as any).mock.calls;
    expect(wdUpdateCalls.length).toBeGreaterThanOrEqual(2);
    expect(wdUpdateCalls[0][0]).toMatchObject({
      where: { id: "wd-1" },
      data: { speakingStatus: "SUBMITTED" },
    });
    // The second update is the COMPLETE flip from maybeMarkDiagnoseComplete.
    expect(wdUpdateCalls[1][0].data).toMatchObject({ status: "COMPLETE" });
  });

  it("diagnose mirror: empty-transcript flips WeeklyDiagnose to AUTO_SUBMITTED", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "t",
      kind: "DIAGNOSE",
      weeklyDiagnose: { id: "wd-1" },
    });
    // Other 5 sections still in progress — gate must NOT flip to COMPLETE.
    (prisma.weeklyDiagnose.findUnique as any).mockResolvedValue({
      readingStatus: "IN_PROGRESS",
      listeningStatus: "IN_PROGRESS",
      writingStatus: "IN_PROGRESS",
      speakingStatus: "AUTO_SUBMITTED",
      vocabStatus: "IN_PROGRESS",
      grammarStatus: "IN_PROGRESS",
      status: "PENDING",
    });
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([]);

    const res = await POST(
      makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);

    const wdUpdateCalls = (prisma.weeklyDiagnose.update as any).mock.calls;
    // First call: speakingStatus=AUTO_SUBMITTED.
    expect(wdUpdateCalls[0][0]).toMatchObject({
      where: { id: "wd-1" },
      data: { speakingStatus: "AUTO_SUBMITTED" },
    });
    // Second call (COMPLETE flip) must NOT happen — gate stays locked.
    const completeCall = wdUpdateCalls.find(
      (call: any) => call[0].data?.status === "COMPLETE",
    );
    expect(completeCall).toBeUndefined();
  });

  it("non-diagnose test: speaking submit does not call weeklyDiagnose.update", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1", userId: "user-1", testId: "t",
      speakingStatus: "IN_PROGRESS", akoolSessionId: "sess-1",
    });
    // Default mock: kind=READING, weeklyDiagnose=null. Mirror must no-op.
    const { readTurns } = await import("@/lib/speaking/turn-buffer");
    (readTurns as any).mockReturnValue([
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
    ]);

    const res = await POST(
      makeReq("attempt-1", { clientTranscript: [] }),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);
    expect(prisma.weeklyDiagnose.update).not.toHaveBeenCalled();
  });
});
