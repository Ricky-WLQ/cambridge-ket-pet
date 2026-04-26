import { describe, it, expect } from "vitest";
import {
  SECTION_TIME_LIMIT_SEC,
  GRACE_SEC,
  DIAGNOSE_SECTION_KINDS,
  deadlineFor,
  cronDeadlineFor,
  isExpired,
  isCronExpired,
  remainingSec,
  type DiagnoseSectionKind,
} from "../sectionLimits";

// Use a fixed anchor so tests are deterministic regardless of wall clock.
const STARTED_AT = new Date("2026-04-20T00:00:00.000Z");

describe("SECTION_TIME_LIMIT_SEC", () => {
  it("has all 6 expected entries with the documented values", () => {
    expect(SECTION_TIME_LIMIT_SEC).toEqual({
      READING: 480,
      LISTENING: 600,
      WRITING: 900,
      SPEAKING: 300,
      VOCAB: 240,
      GRAMMAR: 300,
    });
  });

  it("has exactly 6 keys (no extras)", () => {
    expect(Object.keys(SECTION_TIME_LIMIT_SEC).sort()).toEqual(
      ["GRAMMAR", "LISTENING", "READING", "SPEAKING", "VOCAB", "WRITING"],
    );
  });
});

describe("GRACE_SEC", () => {
  it("is exactly 60 seconds", () => {
    expect(GRACE_SEC).toBe(60);
  });
});

describe("DIAGNOSE_SECTION_KINDS", () => {
  it('equals ["READING","LISTENING","WRITING","SPEAKING","VOCAB","GRAMMAR"] in that exact order', () => {
    expect([...DIAGNOSE_SECTION_KINDS]).toEqual([
      "READING",
      "LISTENING",
      "WRITING",
      "SPEAKING",
      "VOCAB",
      "GRAMMAR",
    ]);
  });

  it("contains all keys from SECTION_TIME_LIMIT_SEC (no missing kinds)", () => {
    expect([...DIAGNOSE_SECTION_KINDS].sort()).toEqual(
      Object.keys(SECTION_TIME_LIMIT_SEC).sort(),
    );
  });
});

describe("deadlineFor", () => {
  it('READING from 2026-04-20T00:00:00Z lands at 2026-04-20T00:08:00Z (+480s)', () => {
    const deadline = deadlineFor("READING", STARTED_AT);
    expect(deadline.toISOString()).toBe("2026-04-20T00:08:00.000Z");
  });

  it("does not mutate the input startedAt", () => {
    const before = STARTED_AT.getTime();
    deadlineFor("LISTENING", STARTED_AT);
    expect(STARTED_AT.getTime()).toBe(before);
  });
});

describe("cronDeadlineFor", () => {
  it("equals deadlineFor + GRACE_SEC seconds", () => {
    const primary = deadlineFor("READING", STARTED_AT);
    const cron = cronDeadlineFor("READING", STARTED_AT);
    expect(cron.getTime() - primary.getTime()).toBe(GRACE_SEC * 1000);
    expect(cron.getTime() - primary.getTime()).toBe(60_000);
  });

  it("READING cron deadline is 2026-04-20T00:09:00Z (+480s+60s)", () => {
    const cron = cronDeadlineFor("READING", STARTED_AT);
    expect(cron.toISOString()).toBe("2026-04-20T00:09:00.000Z");
  });
});

describe("isExpired", () => {
  it("is false immediately after startedAt (well within window)", () => {
    const now = new Date(STARTED_AT.getTime() + 60 * 1000); // +60s
    expect(isExpired("READING", STARTED_AT, now)).toBe(false);
  });

  it("is false 1 ms before the deadline", () => {
    const now = new Date(STARTED_AT.getTime() + 480_000 - 1);
    expect(isExpired("READING", STARTED_AT, now)).toBe(false);
  });

  it("is true at exactly the deadline (>=)", () => {
    const now = new Date(STARTED_AT.getTime() + 480_000);
    expect(isExpired("READING", STARTED_AT, now)).toBe(true);
  });

  it("is true past the deadline", () => {
    const now = new Date(STARTED_AT.getTime() + 480_001);
    expect(isExpired("READING", STARTED_AT, now)).toBe(true);
  });

  it("uses the current wall clock when `now` is omitted (and is false for a fresh start)", () => {
    // startedAt is "now" — no time has elapsed, so it cannot have expired.
    expect(isExpired("READING", new Date())).toBe(false);
  });
});

describe("isCronExpired", () => {
  it("is false at exactly the primary deadline (still within grace)", () => {
    const now = new Date(STARTED_AT.getTime() + 480_000); // +480s, primary expired
    expect(isExpired("READING", STARTED_AT, now)).toBe(true);
    expect(isCronExpired("READING", STARTED_AT, now)).toBe(false);
  });

  it("is false 1 ms before limit + grace", () => {
    const now = new Date(STARTED_AT.getTime() + (480 + 60) * 1000 - 1);
    expect(isCronExpired("READING", STARTED_AT, now)).toBe(false);
  });

  it("is true at exactly limit + grace", () => {
    const now = new Date(STARTED_AT.getTime() + (480 + 60) * 1000);
    expect(isCronExpired("READING", STARTED_AT, now)).toBe(true);
  });

  it("is true past limit + grace", () => {
    const now = new Date(STARTED_AT.getTime() + (480 + 60) * 1000 + 1);
    expect(isCronExpired("READING", STARTED_AT, now)).toBe(true);
  });
});

describe("remainingSec", () => {
  it("returns the full limit when called at startedAt", () => {
    expect(remainingSec("READING", STARTED_AT, STARTED_AT)).toBe(480);
  });

  it("returns the right countdown value mid-section (READING, 100s elapsed → 380s left)", () => {
    const now = new Date(STARTED_AT.getTime() + 100_000);
    expect(remainingSec("READING", STARTED_AT, now)).toBe(380);
  });

  it("returns 0 at exactly the deadline", () => {
    const now = new Date(STARTED_AT.getTime() + 480_000);
    expect(remainingSec("READING", STARTED_AT, now)).toBe(0);
  });

  it("returns 0 (clamped, never negative) past the deadline", () => {
    const now = new Date(STARTED_AT.getTime() + 480_000 + 5_000);
    expect(remainingSec("READING", STARTED_AT, now)).toBe(0);
  });

  it("floors fractional seconds (uses Math.floor on remaining ms)", () => {
    // 100.7s elapsed → 379.3s remaining → floor → 379
    const now = new Date(STARTED_AT.getTime() + 100_700);
    expect(remainingSec("READING", STARTED_AT, now)).toBe(379);
  });
});

describe("all 6 section kinds (parametrized)", () => {
  const cases: Array<{ kind: DiagnoseSectionKind; limit: number }> = [
    { kind: "READING", limit: 480 },
    { kind: "LISTENING", limit: 600 },
    { kind: "WRITING", limit: 900 },
    { kind: "SPEAKING", limit: 300 },
    { kind: "VOCAB", limit: 240 },
    { kind: "GRAMMAR", limit: 300 },
  ];

  for (const { kind, limit } of cases) {
    it(`${kind}: SECTION_TIME_LIMIT_SEC === ${limit}`, () => {
      expect(SECTION_TIME_LIMIT_SEC[kind]).toBe(limit);
    });

    it(`${kind}: deadlineFor uses the configured limit`, () => {
      const deadline = deadlineFor(kind, STARTED_AT);
      expect(deadline.getTime() - STARTED_AT.getTime()).toBe(limit * 1000);
    });

    it(`${kind}: cronDeadlineFor adds exactly GRACE_SEC`, () => {
      const cron = cronDeadlineFor(kind, STARTED_AT);
      expect(cron.getTime() - STARTED_AT.getTime()).toBe(
        (limit + GRACE_SEC) * 1000,
      );
    });

    it(`${kind}: isExpired flips true at the deadline`, () => {
      const justBefore = new Date(STARTED_AT.getTime() + limit * 1000 - 1);
      const exactly = new Date(STARTED_AT.getTime() + limit * 1000);
      expect(isExpired(kind, STARTED_AT, justBefore)).toBe(false);
      expect(isExpired(kind, STARTED_AT, exactly)).toBe(true);
    });

    it(`${kind}: isCronExpired flips true at limit+grace`, () => {
      const justBefore = new Date(
        STARTED_AT.getTime() + (limit + GRACE_SEC) * 1000 - 1,
      );
      const exactly = new Date(STARTED_AT.getTime() + (limit + GRACE_SEC) * 1000);
      expect(isCronExpired(kind, STARTED_AT, justBefore)).toBe(false);
      expect(isCronExpired(kind, STARTED_AT, exactly)).toBe(true);
    });

    it(`${kind}: remainingSec returns full limit at start, 0 at deadline`, () => {
      expect(remainingSec(kind, STARTED_AT, STARTED_AT)).toBe(limit);
      const atDeadline = new Date(STARTED_AT.getTime() + limit * 1000);
      expect(remainingSec(kind, STARTED_AT, atDeadline)).toBe(0);
    });
  }
});
