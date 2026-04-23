import { describe, expect, it } from "vitest";
import { chunkText } from "./chunker";

describe("chunkText", () => {
  it("returns the input as a single chunk if short", () => {
    expect(chunkText("Hello, world.", 400)).toEqual(["Hello, world."]);
  });

  it("splits on sentence boundaries when long", () => {
    const s = "First sentence. Second sentence. Third sentence.";
    const chunks = chunkText(s, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(20 + 5); // tolerate trailing punctuation
    }
  });

  it("splits on comma when no sentence boundary fits", () => {
    const s = "A clause, another clause, yet another clause that is rather long and keeps going.";
    const chunks = chunkText(s, 30);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("handles text without any punctuation by hard-splitting at word boundary", () => {
    const s = "word ".repeat(50).trim();
    const chunks = chunkText(s, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(30 + 5);
    }
  });

  it("preserves total content across chunks (modulo whitespace trimming)", () => {
    const s = "One. Two. Three. Four. Five. Six. Seven.";
    const chunks = chunkText(s, 10);
    expect(chunks.join(" ").replace(/\s+/g, " ").trim()).toBe(
      s.replace(/\s+/g, " ").trim()
    );
  });
});
