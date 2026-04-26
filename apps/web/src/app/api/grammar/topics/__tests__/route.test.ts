import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { grammarTopic: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

beforeEach(() => findMany.mockReset());

const reqWith = (qs: string) => new Request(`http://t/api/grammar/topics?${qs}`);

describe("GET /api/grammar/topics", () => {
  it("returns 400 when examType missing", async () => {
    const res = await GET(reqWith(""));
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(null);
    const res = await GET(reqWith("examType=KET"));
    expect(res.status).toBe(401);
  });

  it("returns topics + byCategory grouping for examType=KET", async () => {
    findMany.mockResolvedValue([
      { id: "t1", examType: "KET", category: "tenses", topicId: "present_simple", labelEn: "Present simple", labelZh: "一般现在时", spec: "...", description: null, examples: [], murphyUnits: [3] },
      { id: "t2", examType: "KET", category: "tenses", topicId: "past_simple", labelEn: "Past simple", labelZh: "一般过去时", spec: "...", description: null, examples: [], murphyUnits: [5] },
      { id: "t3", examType: "KET", category: "modals", topicId: "modals_basic", labelEn: "Modals", labelZh: "情态动词", spec: "...", description: null, examples: [], murphyUnits: [25] },
    ]);
    const res = await GET(reqWith("examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.topics).toHaveLength(3);
    expect(body.byCategory.tenses).toHaveLength(2);
    expect(body.byCategory.modals).toHaveLength(1);
  });

  it("calls findMany with examType filter", async () => {
    findMany.mockResolvedValue([]);
    await GET(reqWith("examType=PET"));
    expect(findMany.mock.calls[0][0].where.examType).toBe("PET");
  });
});
