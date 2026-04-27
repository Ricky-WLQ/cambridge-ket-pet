import { describe, it, expect } from "vitest";
import { reverseSlug, KNOWN_POS } from "../recover-vocab-from-r2";

describe("reverseSlug", () => {
  it("simple word + simple pos", () => {
    expect(reverseSlug("ket-apple-n")).toEqual({ exam: "KET", word: "apple", pos: "n" });
  });
  it("multi-word + simple pos", () => {
    expect(reverseSlug("pet-have-got-to-modal")).toEqual({ exam: "PET", word: "have got to", pos: "modal" });
  });
  it("multi-token pos (n-and-v)", () => {
    expect(reverseSlug("ket-walk-n-and-v")).toEqual({ exam: "KET", word: "walk", pos: "n-and-v" });
  });
  it("phrasal verb pos", () => {
    expect(reverseSlug("ket-give-up-phr-v")).toEqual({ exam: "KET", word: "give up", pos: "phr-v" });
  });
  it("article a/an", () => {
    expect(reverseSlug("ket-a-an-det")).toEqual({ exam: "KET", word: "a/an", pos: "det" });
  });
  it("returns null for malformed slugs", () => {
    expect(reverseSlug("nothing")).toBeNull();
    expect(reverseSlug("ket-only-noPosMatch")).toBeNull();
  });
});
