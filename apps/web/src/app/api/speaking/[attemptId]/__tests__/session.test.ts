import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../session/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    testAttempt: {
      findUnique: vi.fn(),
      update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
    },
    test: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/speaking/akool-client", () => ({
  createAkoolSession: vi.fn(async () => ({
    akoolSessionId: "sess-1",
    streamType: "trtc",
    trtc: { sdkAppId: 111, roomId: "r1", userId: "u1", userSig: "s1" },
  })),
}));
vi.mock("@/lib/r2-signed-url", () => ({
  signR2PublicUrl: vi.fn((key: string, _ttl: number) => `https://r2.example/${key}`),
}));

beforeEach(() => {
  process.env.AKOOL_AVATAR_ID = "avatar-1";
  process.env.AKOOL_VOICE_ID = "voice-1";
  process.env.AKOOL_SESSION_DURATION_SEC = "900";
  process.env.AKOOL_VAD_THRESHOLD = "0.6";
  process.env.AKOOL_VAD_SILENCE_MS = "500";
  vi.clearAllMocks();
});
afterEach(() => vi.restoreAllMocks());

const makeReq = (id: string) =>
  new Request(`http://x/api/speaking/${id}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });

describe("POST /api/speaking/[attemptId]/session", () => {
  it("mints an Akool session for an IDLE attempt and returns TRTC creds", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "IDLE",
    });
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "test-1",
      speakingPrompts: {
        level: "KET",
        initialGreeting: "Hello",
        parts: [
          { partNumber: 1, title: "Interview", targetMinutes: 3, examinerScript: ["q"], coachingHints: "", photoKey: null },
          { partNumber: 2, title: "Photo", targetMinutes: 5, examinerScript: ["q"], coachingHints: "", photoKey: "speaking/photos/park-01.jpg" },
        ],
      },
      speakingPhotoKeys: ["speaking/photos/park-01.jpg"],
      speakingPersona: "KET",
    });

    const res = await POST(makeReq("attempt-1"), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.akoolSessionId).toBe("sess-1");
    expect(json.streamType).toBe("trtc");
    expect(json.trtc).toEqual({ sdkAppId: 111, roomId: "r1", userId: "u1", userSig: "s1" });
    expect(json.test.parts).toHaveLength(2);
    expect(json.test.photoUrls["speaking/photos/park-01.jpg"]).toMatch(/^https:\/\/r2\./);
    expect(prisma.testAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          speakingStatus: "IN_PROGRESS",
          akoolSessionId: "sess-1",
        }),
      }),
    );
  });

  it("returns 409 if the attempt is already IN_PROGRESS", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "IN_PROGRESS",
    });
    const res = await POST(makeReq("attempt-1"), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 when attempt not found or not owned", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue(null);
    const res = await POST(makeReq("nope"), { params: Promise.resolve({ attemptId: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("returns 500 when AKOOL_AVATAR_ID is not configured", async () => {
    delete process.env.AKOOL_AVATAR_ID;
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      testId: "test-1",
      speakingStatus: "IDLE",
    });
    (prisma.test.findUnique as any).mockResolvedValue({
      id: "test-1",
      speakingPrompts: { level: "KET", initialGreeting: "Hi", parts: [] },
      speakingPhotoKeys: [],
      speakingPersona: "KET",
    });
    const res = await POST(makeReq("attempt-1"), { params: Promise.resolve({ attemptId: "attempt-1" }) });
    expect(res.status).toBe(500);
  });
});
