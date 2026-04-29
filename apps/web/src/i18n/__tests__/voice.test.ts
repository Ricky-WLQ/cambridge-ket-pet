import { describe, it, expect } from "vitest";
import { pickTone, type Tone } from "../voice";

describe("pickTone", () => {
  it("returns the value when given a plain string", () => {
    expect(pickTone("hello", "ket")).toBe("hello");
    expect(pickTone("hello", "pet")).toBe("hello");
  });

  it("picks ket variant from a Tone object", () => {
    const t: Tone<string> = { ket: "kid", pet: "teen" };
    expect(pickTone(t, "ket")).toBe("kid");
  });

  it("picks pet variant from a Tone object", () => {
    const t: Tone<string> = { ket: "kid", pet: "teen" };
    expect(pickTone(t, "pet")).toBe("teen");
  });

  it("works with non-string Tone values", () => {
    const t: Tone<number> = { ket: 1, pet: 2 };
    expect(pickTone(t, "ket")).toBe(1);
  });
});
