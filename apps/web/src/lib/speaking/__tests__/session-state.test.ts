import { describe, it, expect } from "vitest";
import {
  parseExaminerOutput,
  SentinelParseError,
} from "../session-state";

describe("parseExaminerOutput", () => {
  it("returns a plain reply when there are no sentinels", () => {
    const out = parseExaminerOutput("Where do you live?", { currentPart: 1, lastPart: 2 });
    expect(out.reply).toBe("Where do you live?");
    expect(out.advancePart).toBeNull();
    expect(out.sessionEnd).toBe(false);
  });

  it("extracts [[PART:N]] and strips it from the reply", () => {
    const out = parseExaminerOutput("Great. [[PART:2]] Now describe this photo.", {
      currentPart: 1,
      lastPart: 2,
    });
    expect(out.advancePart).toBe(2);
    expect(out.reply).toBe("Great. Now describe this photo.");
    expect(out.sessionEnd).toBe(false);
  });

  it("extracts [[SESSION_END]]", () => {
    const out = parseExaminerOutput("Thank you. [[SESSION_END]]", {
      currentPart: 2,
      lastPart: 2,
    });
    expect(out.sessionEnd).toBe(true);
    expect(out.reply).toBe("Thank you.");
  });

  it("rejects advancePart that isn't ahead of current", () => {
    expect(() =>
      parseExaminerOutput("[[PART:1]] no", { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("rejects advancePart beyond last part", () => {
    expect(() =>
      parseExaminerOutput("[[PART:3]] no", { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("collapses whitespace after stripping", () => {
    const out = parseExaminerOutput(
      "Hello   [[PART:2]]   world",
      { currentPart: 1, lastPart: 2 },
    );
    expect(out.reply).toBe("Hello world");
  });

  it("rejects multiple [[PART:N]] sentinels in one reply", () => {
    expect(() =>
      parseExaminerOutput("[[PART:3]] Good. [[PART:2]] Now photo.",
        { currentPart: 1, lastPart: 4 }),
    ).toThrow(SentinelParseError);
  });

  it("rejects malformed [[PART:abc]] (non-numeric)", () => {
    expect(() =>
      parseExaminerOutput("[[PART:abc]] ok",
        { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("rejects malformed [[PART:2.5]] (floating-point)", () => {
    expect(() =>
      parseExaminerOutput("[[PART:2.5]] go",
        { currentPart: 1, lastPart: 2 }),
    ).toThrow(SentinelParseError);
  });

  it("substitutes sentinels with space to prevent word-welding", () => {
    const out = parseExaminerOutput("Thank[[SESSION_END]]you.",
      { currentPart: 2, lastPart: 2 });
    expect(out.sessionEnd).toBe(true);
    expect(out.reply).toBe("Thank you.");
  });
});
