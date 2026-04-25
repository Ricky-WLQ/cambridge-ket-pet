import { describe, expect, it } from "vitest";
import { RUBRIC } from "./rubric";

describe("RUBRIC", () => {
  it("KET opening matches Cambridge verbatim", () => {
    expect(RUBRIC.ket.opening).toContain("Cambridge English");
    expect(RUBRIC.ket.opening).toContain("Key English Test for Schools");
    expect(RUBRIC.ket.opening).toContain("five parts");
    expect(RUBRIC.ket.opening).toContain("each piece twice");
  });

  it("PET opening matches Cambridge verbatim", () => {
    expect(RUBRIC.pet.opening).toContain("Preliminary English Test");
    expect(RUBRIC.pet.opening).toContain("four parts");
    expect(RUBRIC.pet.opening).toContain("each part twice");
  });

  it("partIntro is a function that returns a string with the part number", () => {
    expect(RUBRIC.ket.partIntro(1)).toBe("Now look at the instructions for Part 1.");
    expect(RUBRIC.ket.partIntro(5)).toBe("Now look at the instructions for Part 5.");
    expect(RUBRIC.pet.partIntro(3)).toBe("Now look at the instructions for Part 3.");
  });

  it("partEnd is a function that returns a string with the part number", () => {
    expect(RUBRIC.ket.partEnd(2)).toBe("That is the end of Part 2.");
    expect(RUBRIC.pet.partEnd(4)).toBe("That is the end of Part 4.");
  });

  it("repeatCue is identical for KET and PET", () => {
    expect(RUBRIC.ket.repeatCue).toBe("Now listen again.");
    expect(RUBRIC.pet.repeatCue).toBe("Now listen again.");
  });

  it("transfer/closing phrases are identical for KET and PET", () => {
    expect(RUBRIC.ket.transferStart).toBe(RUBRIC.pet.transferStart);
    expect(RUBRIC.ket.oneMinuteWarn).toBe(RUBRIC.pet.oneMinuteWarn);
    expect(RUBRIC.ket.closing).toBe(RUBRIC.pet.closing);
  });

  it("no rubric string contains an unreplaced placeholder like ${...}", () => {
    const allStrings = [
      RUBRIC.ket.opening,
      RUBRIC.ket.repeatCue,
      RUBRIC.ket.transferStart,
      RUBRIC.ket.oneMinuteWarn,
      RUBRIC.ket.closing,
      RUBRIC.pet.opening,
      RUBRIC.ket.partIntro(1),
      RUBRIC.ket.partEnd(1),
    ];
    for (const s of allStrings) {
      expect(s).not.toMatch(/\$\{/);
    }
  });
});
