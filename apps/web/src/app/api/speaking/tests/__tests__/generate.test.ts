import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../generate/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/rateLimit", () => ({
  checkAndRecordGeneration: vi.fn(async () => ({
    allowed: true,
    count: 1,
    limit: 3,
    resetAt: new Date(Date.now() + 60 * 60 * 1000),
  })),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    test: { create: vi.fn() },
    testAttempt: { create: vi.fn() },
  },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_AI_URL = "http://localhost:8001";
  fetchMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/speaking/tests/generate", () => {
  it("generates a test + attempt and returns the attemptId", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          level: "KET",
          initialGreeting: "Hello, I'm Mina.",
          parts: [
            {
              partNumber: 1,
              title: "Interview",
              targetMinutes: 3,
              examinerScript: ["What's your name?"],
              coachingHints: "",
              photoKey: null,
            },
            {
              partNumber: 2,
              title: "Photo",
              targetMinutes: 5,
              examinerScript: ["Describe this photo."],
              coachingHints: "",
              photoKey: "speaking/photos/park-01.jpg",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const { prisma } = await import("@/lib/prisma");
    (prisma.test.create as any).mockResolvedValue({ id: "test-1" });
    (prisma.testAttempt.create as any).mockResolvedValue({ id: "attempt-1" });

    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.attemptId).toBe("attempt-1");
    expect(prisma.test.create).toHaveBeenCalled();
    expect(prisma.testAttempt.create).toHaveBeenCalled();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { checkAndRecordGeneration } = await import("@/lib/rateLimit");
    (checkAndRecordGeneration as any).mockResolvedValueOnce({
      allowed: false,
      count: 3,
      limit: 3,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("returns 401 without a session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValueOnce(null);
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "KET" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid level", async () => {
    const req = new Request("http://x/api/speaking/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "IELTS" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
