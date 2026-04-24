import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../status/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { testAttempt: { findUnique: vi.fn() } },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

const makeReq = (id: string) =>
  new Request(`http://x/api/speaking/${id}/status`, { method: "GET" });

describe("GET /api/speaking/[attemptId]/status", () => {
  it("returns the full status payload", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "user-1",
      speakingStatus: "SCORED",
      rubricScores: { overall: 3.5 },
      speakingError: null,
    });
    const res = await GET(
      makeReq("attempt-1"),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.speakingStatus).toBe("SCORED");
    expect(json.rubricScores.overall).toBe(3.5);
    expect(json.speakingError).toBeNull();
  });

  it("returns 404 when not owned", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.testAttempt.findUnique as any).mockResolvedValue({
      id: "attempt-1",
      userId: "other-user",
      speakingStatus: "SCORED",
    });
    const res = await GET(
      makeReq("attempt-1"),
      { params: Promise.resolve({ attemptId: "attempt-1" }) },
    );
    expect(res.status).toBe(404);
  });
});
