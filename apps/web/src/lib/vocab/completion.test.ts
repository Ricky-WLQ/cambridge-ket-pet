import { describe, expect, it, vi, beforeEach } from "vitest";
import { isVocabAssignmentComplete } from "./completion";

const count = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { vocabProgress: { count: (...a: unknown[]) => count(...a) } },
}));

beforeEach(() => count.mockReset());

describe("isVocabAssignmentComplete", () => {
  it("returns false when count < target", async () => {
    count.mockResolvedValue(50);
    const out = await isVocabAssignmentComplete({
      userId: "u", examType: "KET", targetTier: "CORE", targetWordCount: 100,
    });
    expect(out).toBe(false);
  });

  it("returns true when count >= target", async () => {
    count.mockResolvedValue(100);
    const out = await isVocabAssignmentComplete({
      userId: "u", examType: "KET", targetTier: "CORE", targetWordCount: 100,
    });
    expect(out).toBe(true);
  });

  it("filters by tier when targetTier is set", async () => {
    count.mockResolvedValue(50);
    await isVocabAssignmentComplete({
      userId: "u", examType: "KET", targetTier: "CORE", targetWordCount: 100,
    });
    expect(count.mock.calls[0][0].where).toMatchObject({
      userId: "u",
      examType: "KET",
      mastery: { gte: 4 },
      wordRef: { tier: "CORE" },
    });
  });

  it("does not filter by tier when targetTier is null (any-tier)", async () => {
    count.mockResolvedValue(80);
    await isVocabAssignmentComplete({
      userId: "u", examType: "KET", targetTier: null, targetWordCount: 50,
    });
    expect(count.mock.calls[0][0].where).not.toHaveProperty("wordRef");
  });

  it("returns false if targetWordCount is null (assignment misconfigured)", async () => {
    const out = await isVocabAssignmentComplete({
      userId: "u", examType: "KET", targetTier: null, targetWordCount: null,
    });
    expect(out).toBe(false);
    expect(count).not.toHaveBeenCalled();
  });
});
