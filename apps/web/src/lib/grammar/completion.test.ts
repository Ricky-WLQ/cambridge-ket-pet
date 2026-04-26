import { describe, expect, it, vi, beforeEach } from "vitest";
import { isGrammarAssignmentComplete } from "./completion";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { grammarProgress: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

beforeEach(() => findMany.mockReset());

describe("isGrammarAssignmentComplete", () => {
  it("returns false when minScore is null (assignment misconfigured)", async () => {
    const out = await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: null, minScore: null,
    });
    expect(out).toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns false when fewer than 10 attempts on the topic", async () => {
    findMany.mockResolvedValue(Array.from({ length: 9 }, () => ({ isCorrect: true })));
    const out = await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: "topic-1", minScore: 70,
    });
    expect(out).toBe(false);
  });

  it("returns true when accuracy meets threshold over >= 10 attempts", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ isCorrect: i < 8 }));
    findMany.mockResolvedValue(rows);
    const out = await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: "topic-1", minScore: 70,
    });
    expect(out).toBe(true);
  });

  it("returns false when accuracy below threshold", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ isCorrect: i < 6 }));
    findMany.mockResolvedValue(rows);
    const out = await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: "topic-1", minScore: 70,
    });
    expect(out).toBe(false);
  });

  it("filters by topicId when set; uses all-topic data otherwise", async () => {
    findMany.mockResolvedValue([]);
    await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: "topic-1", minScore: 70,
    });
    expect(findMany.mock.calls[0][0].where).toMatchObject({
      userId: "u", examType: "KET", topicId: "topic-1",
    });

    findMany.mockReset();
    findMany.mockResolvedValue([]);
    await isGrammarAssignmentComplete({
      userId: "u", examType: "KET", targetTopicId: null, minScore: 70,
    });
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("topicId");
  });
});
