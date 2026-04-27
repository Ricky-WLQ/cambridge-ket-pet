import { describe, it, expect } from "vitest";
import {
  currentWeekStart,
  currentWeekEnd,
  previousWeekStart,
  isSameIsoWeekCST,
  formatWeekRangeZh,
} from "../week";

// All test fixtures are anchored to known instants in UTC + CST:
//
//   2026-04-20 00:00 CST  =  2026-04-19 16:00 UTC   (Monday)
//   2026-04-20 12:00 CST  =  2026-04-20 04:00 UTC   (Monday noon)
//   2026-04-26 23:59:59.999 CST  =  2026-04-26 15:59:59.999 UTC (Sunday end)
//   2026-04-27 00:00 CST  =  2026-04-26 16:00 UTC   (next Monday)

describe("currentWeekStart", () => {
  it("returns Monday 00:00 CST when given Monday 12:00 CST", () => {
    // Monday 12:00 CST = 04:00 UTC
    const monNoonCst = new Date("2026-04-20T04:00:00.000Z");
    const start = currentWeekStart(monNoonCst);
    expect(start.toISOString()).toBe("2026-04-19T16:00:00.000Z"); // Mon 00:00 CST
  });

  it("returns the SAME Monday 00:00 CST when given Sunday 23:59 CST (last second of the week)", () => {
    // Sunday 23:59:59.999 CST = 15:59:59.999 UTC
    const sunLastTickCst = new Date("2026-04-26T15:59:59.999Z");
    const start = currentWeekStart(sunLastTickCst);
    expect(start.toISOString()).toBe("2026-04-19T16:00:00.000Z"); // same Monday
  });

  it("returns the NEXT Monday 00:00 CST when given Monday 00:00 CST exactly (boundary moment)", () => {
    // Monday 2026-04-27 00:00 CST = 2026-04-26 16:00 UTC
    const newMonStartUtc = new Date("2026-04-26T16:00:00.000Z");
    const start = currentWeekStart(newMonStartUtc);
    expect(start.toISOString()).toBe("2026-04-26T16:00:00.000Z"); // the same instant — start of new week
  });
});

describe("currentWeekEnd", () => {
  it("returns Sunday 23:59:59.999 CST as a UTC instant", () => {
    // Pick any moment in the week of 2026-04-20 → 2026-04-26 CST.
    const wedNoonCst = new Date("2026-04-22T04:00:00.000Z"); // Wed 12:00 CST
    const end = currentWeekEnd(wedNoonCst);
    // Sunday 23:59:59.999 CST = 15:59:59.999 UTC
    expect(end.toISOString()).toBe("2026-04-26T15:59:59.999Z");
  });
});

describe("previousWeekStart", () => {
  it("is exactly 7 days before currentWeekStart", () => {
    const monNoonCst = new Date("2026-04-20T04:00:00.000Z");
    const start = currentWeekStart(monNoonCst);
    const prev = previousWeekStart(start);
    expect(start.getTime() - prev.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(prev.toISOString()).toBe("2026-04-12T16:00:00.000Z"); // 2026-04-13 00:00 CST
  });

  it("normalizes mid-week input to the prior week's Monday", () => {
    // Wed mid-week — should still find the *prior* week's Monday
    const wedNoonCst = new Date("2026-04-22T04:00:00.000Z");
    const prev = previousWeekStart(wedNoonCst);
    expect(prev.toISOString()).toBe("2026-04-12T16:00:00.000Z");
  });
});

describe("isSameIsoWeekCST", () => {
  it("returns true for two instants within the same CST ISO week", () => {
    const monMorning = new Date("2026-04-20T01:00:00.000Z"); // Mon 09:00 CST
    const sunEvening = new Date("2026-04-26T13:00:00.000Z"); // Sun 21:00 CST
    expect(isSameIsoWeekCST(monMorning, sunEvening)).toBe(true);
  });

  it("returns false across the Sunday→Monday boundary", () => {
    const sunLast = new Date("2026-04-26T15:59:59.999Z"); // Sun 23:59:59.999 CST
    const monFirst = new Date("2026-04-26T16:00:00.000Z"); // Mon 00:00:00 CST
    expect(isSameIsoWeekCST(sunLast, monFirst)).toBe(false);
  });
});

describe("formatWeekRangeZh", () => {
  it('produces the exact zh-CN string "2026-04-20 周一 — 04-26 周日" for a known input', () => {
    const monNoonCst = new Date("2026-04-20T04:00:00.000Z");
    expect(formatWeekRangeZh(monNoonCst)).toBe("2026-04-20 周一 — 04-26 周日");
  });

  it("shows correct month transitions across a month boundary", () => {
    // 2026-03-30 is a Monday; week is 2026-03-30 → 2026-04-05
    // Pick Tuesday afternoon to also verify normalization.
    const tueAfternoonCst = new Date("2026-03-31T08:00:00.000Z"); // Tue 16:00 CST
    expect(formatWeekRangeZh(tueAfternoonCst)).toBe(
      "2026-03-30 周一 — 04-05 周日",
    );
  });
});

describe("year rollover (ISO week 53)", () => {
  it("computes Monday correctly for early-Jan dates that fall in the prior year's ISO week 53", () => {
    // 2021-01-01 is a Friday and belongs to ISO week 53 of 2020
    // (whose Monday is 2020-12-28).
    // 2021-01-01 12:00 CST = 2021-01-01 04:00 UTC
    const friNewYear = new Date("2021-01-01T04:00:00.000Z");
    const start = currentWeekStart(friNewYear);
    // 2020-12-28 00:00 CST = 2020-12-27 16:00 UTC
    expect(start.toISOString()).toBe("2020-12-27T16:00:00.000Z");

    // formatWeekRangeZh should show the rollover: starts in 2020, ends in 2021
    expect(formatWeekRangeZh(friNewYear)).toBe("2020-12-28 周一 — 01-03 周日");
  });
});

describe("UTC vs CST disambiguation", () => {
  it("input at 23:00 UTC on a Sunday is actually Monday 07:00 CST → returns the NEW week's Monday", () => {
    // 2026-04-26 23:00 UTC = 2026-04-27 07:00 CST (a Monday in the *new* week)
    const utcSunLate = new Date("2026-04-26T23:00:00.000Z");
    const start = currentWeekStart(utcSunLate);
    // The new week's Monday: 2026-04-27 00:00 CST = 2026-04-26 16:00 UTC
    expect(start.toISOString()).toBe("2026-04-26T16:00:00.000Z");

    // Sanity: it must NOT equal the prior Monday (2026-04-19 16:00 UTC).
    expect(start.toISOString()).not.toBe("2026-04-19T16:00:00.000Z");
  });
});
