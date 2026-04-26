import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, getCategoryLabel, ALL_CATEGORIES } from "./taxonomy";

describe("CATEGORY_LABELS", () => {
  it("contains the 11 KET categories", () => {
    const expected = [
      "tenses", "modals", "verb_forms", "clause_types", "interrogatives",
      "nouns", "pronouns", "adjectives", "adverbs", "prepositions", "connectives",
    ];
    for (const cat of expected) {
      expect(CATEGORY_LABELS).toHaveProperty(cat);
      expect(CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]).toMatchObject({
        zh: expect.any(String),
        en: expect.any(String),
      });
    }
  });

  it("contains the 3 PET-only categories on top of KET", () => {
    expect(CATEGORY_LABELS).toHaveProperty("conditionals");
    expect(CATEGORY_LABELS).toHaveProperty("reported_speech");
    expect(CATEGORY_LABELS).toHaveProperty("phrasal_verbs");
  });

  it("zh labels are Chinese (contain CJK characters)", () => {
    for (const slug of Object.keys(CATEGORY_LABELS)) {
      const zh = CATEGORY_LABELS[slug as keyof typeof CATEGORY_LABELS].zh;
      const hasCjk = /[一-鿿]/.test(zh);
      expect(hasCjk, `${slug}.zh should contain CJK: got ${JSON.stringify(zh)}`).toBe(true);
    }
  });
});

describe("getCategoryLabel", () => {
  it("returns the matching label", () => {
    expect(getCategoryLabel("tenses")).toEqual({ zh: "时态", en: "Tenses" });
  });

  it("falls back to the slug for unknown categories", () => {
    expect(getCategoryLabel("totally_made_up")).toEqual({
      zh: "totally_made_up",
      en: "totally_made_up",
    });
  });
});

describe("ALL_CATEGORIES", () => {
  it("equals Object.keys(CATEGORY_LABELS) (order-deterministic)", () => {
    expect(ALL_CATEGORIES).toEqual(Object.keys(CATEGORY_LABELS));
  });
});
