import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order in results", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      // Randomize-ish delay to force out-of-order completion
      await new Promise((r) => setTimeout(r, (5 - n) * 10));
      return n * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects the concurrency cap (peak in-flight = concurrency)", async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    await mapWithConcurrency(items, 3, async (_n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 10));
      active--;
      return _n;
    });

    expect(peak).toBe(3);
  });

  it("handles concurrency > items.length by capping workers", async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (n) => n * 10);
    expect(results).toEqual([10, 20]);
  });

  it("propagates errors without swallowing", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error(`bad: ${n}`);
        return n;
      }),
    ).rejects.toThrow("bad: 2");
  });
});
