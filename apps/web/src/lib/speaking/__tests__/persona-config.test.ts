import { describe, it, expect } from "vitest";
import { buildPersonaSummary } from "../persona-config";

describe("buildPersonaSummary", () => {
  it("builds KET-level summary", () => {
    const out = buildPersonaSummary({
      level: "KET",
      initialGreeting: "Hello, I'm Mina.",
      partCount: 2,
    });
    expect(out).toContain("KET");
    expect(out).toContain("Mina");
    expect(out).toContain("2 parts");
  });

  it("builds PET-level summary", () => {
    const out = buildPersonaSummary({
      level: "PET",
      initialGreeting: "Hi, I'm Mina.",
      partCount: 4,
    });
    expect(out).toContain("PET");
    expect(out).toContain("4 parts");
  });
});
