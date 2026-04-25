import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../route";

// Stub auth — return a fake session.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

// Stub Prisma — record the args passed to findMany + count.
const findMany = vi.fn();
const count = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    word: {
      findMany: (...a: unknown[]) => findMany(...a),
      count: (...a: unknown[]) => count(...a),
    },
  },
}));

beforeEach(() => {
  findMany.mockReset();
  count.mockReset();
});

function makeReq(qs: string): Request {
  return new Request(`http://test/api/vocab/words?${qs}`);
}

describe("GET /api/vocab/words", () => {
  it("rejects when examType is missing", async () => {
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("returns paginated words for examType=KET", async () => {
    findMany.mockResolvedValue([
      { id: "w1", examType: "KET", cambridgeId: "ket-act-v", word: "act", pos: "v", phonetic: null, glossEn: null, glossZh: "表演", example: "She acts.", topics: [], tier: "CORE", audioKey: null },
    ]);
    count.mockResolvedValue(1);
    const res = await GET(makeReq("examType=KET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.words).toHaveLength(1);
    expect(body.totalCount).toBe(1);
  });

  it("applies tier filter when provided", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await GET(makeReq("examType=KET&tier=CORE"));
    const where = findMany.mock.calls[0][0].where;
    expect(where.examType).toBe("KET");
    expect(where.tier).toBe("CORE");
  });

  it("applies search filter as case-insensitive contains on word OR glossZh", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await GET(makeReq("examType=KET&search=act"));
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { word: { contains: "act", mode: "insensitive" } },
        { glossZh: { contains: "act", mode: "insensitive" } },
      ]),
    );
  });

  it("caps pageSize at 100", async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await GET(makeReq("examType=KET&pageSize=500"));
    expect(findMany.mock.calls[0][0].take).toBe(100);
  });

  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(null);
    const res = await GET(makeReq("examType=KET"));
    expect(res.status).toBe(401);
  });
});
