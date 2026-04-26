import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findMany = vi.fn();
const findUnique = vi.fn();
const upsert = vi.fn();
const deleteMany = vi.fn();
const wordFindUnique = vi.fn();
const wordGroupBy = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    vocabProgress: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      upsert: (...a: unknown[]) => upsert(...a),
      deleteMany: (...a: unknown[]) => deleteMany(...a),
    },
    word: {
      findUnique: (...a: unknown[]) => wordFindUnique(...a),
      groupBy: (...a: unknown[]) => wordGroupBy(...a),
    },
  },
}));

beforeEach(() => {
  [findMany, findUnique, upsert, deleteMany, wordFindUnique, wordGroupBy].forEach((m) => m.mockReset());
});

const reqWith = (path: string, init?: RequestInit) => new Request(`http://t${path}`, init);

describe("GET /api/vocab/progress", () => {
  it("requires examType", async () => {
    const res = await GET(reqWith("/api/vocab/progress"));
    expect(res.status).toBe(400);
  });

  it("returns progress + aggregated stats + wordlistTotals", async () => {
    findMany.mockResolvedValue([
      { wordId: "w1", word: "act", mastery: 5, lastReviewed: new Date("2026-04-26"), nextReview: new Date("2026-05-26"), reviewCount: 3, correctCount: 3, wordRef: { tier: "CORE" } },
      { wordId: "w2", word: "go",  mastery: 2, lastReviewed: new Date("2026-04-25"), nextReview: new Date("2026-04-25T13:00:00Z"), reviewCount: 1, correctCount: 1, wordRef: { tier: "RECOMMENDED" } },
      { wordId: "w3", word: "be",  mastery: 4, lastReviewed: new Date("2026-04-24"), nextReview: new Date("2026-05-01"), reviewCount: 5, correctCount: 4, wordRef: { tier: "CORE" } },
    ]);
    wordGroupBy.mockResolvedValue([
      { tier: "CORE",        _count: { _all: 800 } },
      { tier: "RECOMMENDED", _count: { _all: 400 } },
      { tier: "EXTRA",       _count: { _all: 419 } },
    ]);
    const res = await GET(reqWith("/api/vocab/progress?examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.total).toBe(3);
    expect(body.stats.mastered).toBe(2);  // mastery >= 4
    expect(body.stats.byTier.CORE.total).toBe(2);
    expect(body.stats.byTier.CORE.mastered).toBe(2);
    expect(body.stats.byMastery).toEqual([0, 0, 1, 0, 1, 1]);
    expect(body.wordlistTotals.byTier.CORE).toBe(800);
    expect(body.wordlistTotals.byTier.RECOMMENDED).toBe(400);
    expect(body.wordlistTotals.byTier.EXTRA).toBe(419);
    expect(body.wordlistTotals.total).toBe(1619);
  });

  it("returns wordlistTotals even with 0 user progress (fresh student)", async () => {
    findMany.mockResolvedValue([]);  // no user progress rows
    wordGroupBy.mockResolvedValue([
      { tier: "CORE",        _count: { _all: 800 } },
      { tier: "RECOMMENDED", _count: { _all: 400 } },
      { tier: "EXTRA",       _count: { _all: 418 } },
    ]);
    const res = await GET(reqWith("/api/vocab/progress?examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // user-progress aggregates are all zero
    expect(body.stats.total).toBe(0);
    expect(body.stats.mastered).toBe(0);
    expect(body.stats.byTier.CORE.total).toBe(0);
    expect(body.stats.byTier.CORE.mastered).toBe(0);
    // but wordlist denominators come from prisma.word.groupBy and are populated
    expect(body.wordlistTotals.total).toBe(1618);
    expect(body.wordlistTotals.byTier.CORE).toBe(800);
    expect(body.wordlistTotals.byTier.RECOMMENDED).toBe(400);
    expect(body.wordlistTotals.byTier.EXTRA).toBe(418);
  });
});

describe("POST /api/vocab/progress", () => {
  it("upserts and applies SRS on correct answer", async () => {
    findUnique.mockResolvedValue(null);  // no prior progress
    wordFindUnique.mockResolvedValue({ id: "w1", word: "act", examType: "KET" });
    upsert.mockResolvedValue({ wordId: "w1", word: "act", mastery: 1 });
    const res = await POST(reqWith("/api/vocab/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: "w1", examType: "KET", isCorrect: true }),
    }));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledOnce();
    const args = upsert.mock.calls[0][0];
    expect(args.create.mastery).toBe(1);
    expect(args.create.nextReview).toBeInstanceOf(Date);
  });

  it("rejects when wordId missing", async () => {
    const res = await POST(reqWith("/api/vocab/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET", isCorrect: true }),
    }));
    expect(res.status).toBe(400);
  });

  it("markMastered jumps to mastery 4", async () => {
    findUnique.mockResolvedValue({ wordId: "w1", word: "act", mastery: 0, reviewCount: 0, correctCount: 0 });
    wordFindUnique.mockResolvedValue({ id: "w1", word: "act", examType: "KET" });
    upsert.mockResolvedValue({});
    await POST(reqWith("/api/vocab/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: "w1", examType: "KET", isCorrect: true, markMastered: true }),
    }));
    const args = upsert.mock.calls[0][0];
    expect(args.update.mastery).toBe(4);
  });
});

describe("PUT /api/vocab/progress (due-now query)", () => {
  it("returns dueWords filtered by nextReview <= NOW", async () => {
    findMany.mockResolvedValue([
      { wordId: "w1", word: "act", mastery: 1, lastReviewed: new Date(), nextReview: new Date(Date.now() - 1000), reviewCount: 1, correctCount: 1 },
    ]);
    const res = await PUT(reqWith("/api/vocab/progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET", limit: 20 }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dueWords).toHaveLength(1);
    expect(findMany.mock.calls[0][0].where.nextReview.lte).toBeInstanceOf(Date);
  });
});

describe("DELETE /api/vocab/progress", () => {
  it("requires examType, calls deleteMany", async () => {
    deleteMany.mockResolvedValue({ count: 42 });
    const res = await DELETE(reqWith("/api/vocab/progress?examType=KET"));
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", examType: "KET" } });
  });

  it("scoped by tier when provided (joins to Word)", async () => {
    deleteMany.mockResolvedValue({ count: 10 });
    await DELETE(reqWith("/api/vocab/progress?examType=KET&tier=CORE"));
    expect(deleteMany.mock.calls[0][0].where).toMatchObject({
      userId: "user-1",
      examType: "KET",
      wordRef: { tier: "CORE" },
    });
  });
});
