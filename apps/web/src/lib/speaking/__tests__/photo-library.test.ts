import { describe, it, expect } from "vitest";
import { pickPhotoKeys, PHOTO_LIBRARY_MANIFEST } from "../photo-library";

describe("photo-library", () => {
  it("returns N distinct keys tagged with the requested topic", () => {
    const keys = pickPhotoKeys({ level: "KET", topic: "daily-life", count: 2 });
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
    for (const k of keys) {
      const entry = PHOTO_LIBRARY_MANIFEST.find((p) => p.key === k);
      expect(entry).toBeDefined();
      expect(entry!.tags).toContain("daily-life");
      expect(entry!.levels).toContain("KET");
    }
  });

  it("falls back to any photo for the level when topic has too few matches", () => {
    const keys = pickPhotoKeys({ level: "PET", topic: "nonexistent-topic", count: 3 });
    expect(keys).toHaveLength(3);
    for (const k of keys) {
      const entry = PHOTO_LIBRARY_MANIFEST.find((p) => p.key === k);
      expect(entry!.levels).toContain("PET");
    }
  });

  it("throws when the manifest has fewer than `count` entries for the level", () => {
    expect(() => pickPhotoKeys({ level: "KET", topic: "anything", count: 999 })).toThrow(
      /not enough photos/i,
    );
  });
});
