import { describe, it, expect } from "vitest";
import { BANNED_PHRASES, findBanned } from "../banned-phrases";

describe("BANNED_PHRASES", () => {
  it("matches the Python list", () => {
    expect(BANNED_PHRASES).toContain("决定通过率");
    expect(BANNED_PHRASES).toContain("[critical]");
    expect(BANNED_PHRASES).toHaveLength(14);
  });

  it("findBanned detects matches", () => {
    expect(findBanned("Reading 33%，属于低分段")).toContain("属于低分段");
  });

  it("findBanned returns empty for clean text", () => {
    expect(findBanned("加油 →")).toEqual([]);
  });
});
