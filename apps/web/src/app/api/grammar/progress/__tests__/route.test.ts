import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grammarProgress: {
      findMany: (...a: unknown[]) => findMany(...a),
      findUnique: (...a: unknown[]) => findUnique(...a),
      create: (...a: unknown[]) => create(...a),
    },
  },
}));

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
  create.mockReset();
});

const reqWith = (path: string, init?: RequestInit) => new Request(`http://t${path}`, init);

describe("GET /api/grammar/progress", () => {
  it("requires examType", async () => {
    const res = await GET(reqWith("/api/grammar/progress"));
    expect(res.status).toBe(400);
  });

  it("returns aggregated stats with perTopic + weakTopics", async () => {
    findMany.mockResolvedValue([
      { topicId: "tenses_present", isCorrect: true },
      { topicId: "tenses_present", isCorrect: true },
      { topicId: "tenses_present", isCorrect: false },
      { topicId: "modals_basic", isCorrect: true },
      { topicId: "passive", isCorrect: false },
      { topicId: "passive", isCorrect: false },
      { topicId: "passive", isCorrect: true },
    ]);
    const res = await GET(reqWith("/api/grammar/progress?examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalAttempted).toBe(7);
    expect(body.totalCorrect).toBe(4);
    expect(body.accuracy).toBeCloseTo(4 / 7, 2);
    expect(body.perTopic).toHaveLength(3);
    expect(body.weakTopics).toEqual(["passive"]);
  });
});

describe("POST /api/grammar/progress", () => {
  it("creates a new progress row with snapshot fields", async () => {
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: "p1" });
    const res = await POST(reqWith("/api/grammar/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionId: "q1", examType: "KET", topicId: "tenses_present",
        userAnswer: 2, isCorrect: true,
        questionText: "She _____ since 2018.",
        questionOptions: ["works", "worked", "has worked", "will work"],
        correctIndex: 2,
        explanationZh: "现在完成时。",
      }),
    }));
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledOnce();
    const args = create.mock.calls[0][0];
    expect(args.data.userId).toBe("user-1");
    expect(args.data.questionText).toBe("She _____ since 2018.");
    expect(args.data.questionOptions).toEqual(["works", "worked", "has worked", "will work"]);
    expect(args.data.correctIndex).toBe(2);
    expect(args.data.userAnswer).toBe(2);
    expect(args.data.isCorrect).toBe(true);
    expect(args.data.status).toBeUndefined();
  });

  it("is idempotent — skips create when (userId, questionId) already exists", async () => {
    findUnique.mockResolvedValue({ id: "existing-p" });
    const res = await POST(reqWith("/api/grammar/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionId: "q1", examType: "KET", topicId: "tenses_present",
        userAnswer: 2, isCorrect: true,
        questionText: "...", questionOptions: ["a","b","c","d"], correctIndex: 0, explanationZh: "解析",
      }),
    }));
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects when required fields missing", async () => {
    const res = await POST(reqWith("/api/grammar/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questionId: "q1" }),
    }));
    expect(res.status).toBe(400);
  });
});
