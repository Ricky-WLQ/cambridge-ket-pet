import { describe, expect, it } from "vitest";
import { voiceNameFor, VOICE_CAST, ALL_VOICE_TAGS } from "./voices";

describe("voiceNameFor", () => {
  it("maps every VoiceTag to an en-GB-* identifier", () => {
    for (const tag of ALL_VOICE_TAGS) {
      const voice = voiceNameFor(tag);
      expect(voice).toMatch(/^en-GB-[A-Za-z]+Neural$/);
    }
  });

  it("proctor → Thomas", () => {
    expect(voiceNameFor("proctor")).toBe("en-GB-ThomasNeural");
  });

  it("S1_male → Ryan", () => {
    expect(voiceNameFor("S1_male")).toBe("en-GB-RyanNeural");
  });

  it("S2_female_A → Sonia", () => {
    expect(voiceNameFor("S2_female_A")).toBe("en-GB-SoniaNeural");
  });

  it("S2_female_B → Libby (distinct from A for same-gender pairs)", () => {
    expect(voiceNameFor("S2_female_B")).toBe("en-GB-LibbyNeural");
    expect(voiceNameFor("S2_female_B")).not.toBe(voiceNameFor("S2_female_A"));
  });
});

describe("VOICE_CAST", () => {
  it("exports exactly 4 voices", () => {
    expect(Object.keys(VOICE_CAST)).toHaveLength(4);
  });
});
