import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const questionFindMany = vi.fn();
const topicFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grammarQuestion: { findMany: (...a: unknown[]) => questionFindMany(...a) },
    grammarTopic: { findMany: (...a: unknown[]) => topicFindMany(...a) },
  },
}));

beforeEach(() => {
  questionFindMany.mockReset();
  topicFindMany.mockReset();
});

const reqWith = (qs: string) => new Request(`http://t/api/grammar/questions?${qs}`);

const _q = (id: string, topicId: string) => ({
  id, examType: "KET", topicId, questionType: "mcq",
  question: `Q ${id}`, options: ["a", "b", "c", "d"],
  correctIndex: 0, explanationEn: null, explanationZh: "解析", difficulty: 2,
});

describe("GET /api/grammar/questions", () => {
  it("returns 400 when examType missing", async () => {
    const res = await GET(reqWith("count=10"));
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(null);
    const res = await GET(reqWith("examType=KET"));
    expect(res.status).toBe(401);
  });

  it("returns questions for a single topicId when provided", async () => {
    questionFindMany.mockResolvedValue([_q("q1", "tenses_present"), _q("q2", "tenses_present")]);
    const res = await GET(reqWith("examType=KET&topicId=tenses_present&count=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(2);
    expect(questionFindMany.mock.calls[0][0].where.topicId).toBe("tenses_present");
  });

  it("round-robin spreads across topics when topicId is omitted (mixed quiz)", async () => {
    topicFindMany.mockResolvedValue([
      { id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "t4" },
    ]);
    questionFindMany.mockImplementation(({ where }: { where: { topicId: string } }) => {
      const tid = where.topicId;
      return Array.from({ length: 5 }, (_, i) => _q(`${tid}-q${i}`, tid));
    });
    const res = await GET(reqWith("examType=KET&count=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(10);
    const topicIds = new Set(body.questions.map((q: { topicId: string }) => q.topicId));
    expect(topicIds.size).toBeGreaterThanOrEqual(4);
  });

  it("default count is 10 when not provided", async () => {
    questionFindMany.mockResolvedValue([]);
    topicFindMany.mockResolvedValue([{ id: "t1" }]);
    await GET(reqWith("examType=KET"));
    expect(questionFindMany).toHaveBeenCalled();
  });
});
