import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findMany = vi.fn();
const count = vi.fn();
const groupBy = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grammarProgress: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
      groupBy: (...a: unknown[]) => groupBy(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

beforeEach(() => [findMany, count, groupBy, update].forEach((m) => m.mockReset()));

const reqWith = (path: string, init?: RequestInit) => new Request(`http://t${path}`, init);

describe("GET /api/grammar/mistakes", () => {
  it("requires examType", async () => {
    const res = await GET(reqWith("/api/grammar/mistakes"));
    expect(res.status).toBe(400);
  });

  it("returns paginated mistakes + counts grouped by status", async () => {
    findMany.mockResolvedValue([
      { id: "m1", topicId: "tenses_present", questionText: "Q1", questionOptions: ["a","b","c","d"], correctIndex: 0, userAnswer: 1, explanationZh: "解析", status: "NEW", createdAt: new Date("2026-04-26") },
    ]);
    count.mockResolvedValue(1);
    groupBy.mockResolvedValue([
      { status: "NEW", _count: { _all: 5 } },
      { status: "REVIEWED", _count: { _all: 3 } },
      { status: "MASTERED", _count: { _all: 2 } },
    ]);
    const res = await GET(reqWith("/api/grammar/mistakes?examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.counts).toEqual({ NEW: 5, REVIEWED: 3, MASTERED: 2, total: 10 });
    expect(body.grouped.byTopic).toBeDefined();
  });

  it("filters by status when provided", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    groupBy.mockResolvedValue([]);
    await GET(reqWith("/api/grammar/mistakes?examType=KET&status=NEW"));
    expect(findMany.mock.calls[0][0].where.status).toBe("NEW");
  });
});

describe("PUT /api/grammar/mistakes", () => {
  it("updates status when valid", async () => {
    update.mockResolvedValue({ id: "m1", status: "REVIEWED" });
    const res = await PUT(reqWith("/api/grammar/mistakes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "m1", status: "REVIEWED" }),
    }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      where: { id: "m1", userId: "user-1" },
      data: { status: "REVIEWED", reviewedAt: expect.any(Date) },
    });
  });

  it("rejects invalid status", async () => {
    const res = await PUT(reqWith("/api/grammar/mistakes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "m1", status: "BOGUS" }),
    }));
    expect(res.status).toBe(400);
  });

  it("rejects when id missing", async () => {
    const res = await PUT(reqWith("/api/grammar/mistakes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "NEW" }),
    }));
    expect(res.status).toBe(400);
  });
});
