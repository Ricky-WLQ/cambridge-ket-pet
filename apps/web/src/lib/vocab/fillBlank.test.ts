import { describe, expect, it } from "vitest";
import { generateFillBlank } from "./fillBlank";

describe("generateFillBlank", () => {
  it("returns segments alternating text and blank", () => {
    const result = generateFillBlank("actually", { blankRatio: 0.4, seed: 42 });
    expect(result.word).toBe("actually");
    expect(result.segments.length).toBeGreaterThan(0);
    const recon = result.segments
      .map((s) => (s.kind === "letter" ? s.letter : "?".repeat(s.length)))
      .join("");
    expect(recon.length).toBe("actually".length);
  });

  it("never blanks position 0 (first letter is always shown)", () => {
    for (let i = 0; i < 20; i++) {
      const result = generateFillBlank("actually", { blankRatio: 0.6, seed: i });
      expect(result.segments[0].kind).toBe("letter");
      if (result.segments[0].kind === "letter") {
        expect(result.segments[0].letter).toBe("a");
      }
    }
  });

  it("for 1-letter word, returns the letter (no blanks possible)", () => {
    const result = generateFillBlank("a", { blankRatio: 0.4, seed: 1 });
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toEqual({ kind: "letter", letter: "a" });
  });

  it("preserves apostrophes and hyphens as letter segments (never blanked)", () => {
    const result = generateFillBlank("don't", { blankRatio: 0.6, seed: 1 });
    const apostrophe = result.segments.find(
      (s) => s.kind === "letter" && s.letter === "'",
    );
    expect(apostrophe).toBeDefined();
    const result2 = generateFillBlank("well-known", { blankRatio: 0.6, seed: 1 });
    const hyphen = result2.segments.find(
      (s) => s.kind === "letter" && s.letter === "-",
    );
    expect(hyphen).toBeDefined();
  });

  it("answers field lists the blanked letters in order", () => {
    const result = generateFillBlank("actually", { blankRatio: 0.4, seed: 42 });
    const blanksFromSegments = result.segments
      .filter((s) => s.kind === "blank")
      .flatMap((s) => s.kind === "blank" ? s.answers : []);
    expect(result.answers).toEqual(blanksFromSegments);
    expect(result.answers.length).toBeGreaterThan(0);
  });

  it("seeded calls are deterministic", () => {
    const a = generateFillBlank("actually", { blankRatio: 0.4, seed: 99 });
    const b = generateFillBlank("actually", { blankRatio: 0.4, seed: 99 });
    expect(a).toEqual(b);
  });
});
