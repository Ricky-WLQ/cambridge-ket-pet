/**
 * Vitest suite for diagnose-gate eligibility (T8).
 *
 * Strategy:
 *  - The pure decision logic (`decideGateState`) is exercised exhaustively
 *    across all 5 DiagnoseStatus values + null. This is the source of truth
 *    for the gate semantics; if it's right, the async wrappers are right.
 *
 *  - The async DB-touching wrappers (`findCurrentWeekDiagnose`,
 *    `getRequiredDiagnoseId`, `isCompletedThisWeek`, `requireUngated`) are
 *    verified with mock-based tests:
 *     - `@/lib/prisma` is mocked so `weeklyDiagnose.findUnique` is a vi.fn
 *       the test controls.
 *     - `next/navigation`'s `redirect` is mocked to throw a known error
 *       so we can assert which path it was given.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WeeklyDiagnose } from "@prisma/client";

// ─── module-level mocks ──────────────────────────────────────────────────────

const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyDiagnose: {
      findUnique: (...a: unknown[]) => findUnique(...a),
    },
  },
}));

class RedirectError extends Error {
  constructor(public path: string) {
    super(`NEXT_REDIRECT:${path}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new RedirectError(path);
  },
}));

// Imports must come AFTER vi.mock() declarations — vitest hoists vi.mock
// so this works, but keeping the import order explicit makes the intent
// clear to readers.
import {
  decideGateState,
  findCurrentWeekDiagnose,
  getRequiredDiagnoseId,
  isCompletedThisWeek,
  requireUngated,
  NEED_GENERATE_SENTINEL,
} from "../eligibility";

beforeEach(() => {
  findUnique.mockReset();
});

// ─── builders ────────────────────────────────────────────────────────────────

/**
 * Build a minimal WeeklyDiagnose row for tests. Only the fields read by
 * `decideGateState` (id, status) actually matter; everything else is
 * filled with placeholder values so the type checks.
 */
function buildRow(overrides: Partial<WeeklyDiagnose> & { id: string; status: WeeklyDiagnose["status"] }): WeeklyDiagnose {
  return {
    userId: "user-1",
    weekStart: new Date("2026-04-19T16:00:00.000Z"),
    weekEnd: new Date("2026-04-26T15:59:59.999Z"),
    testId: "test-1",
    examType: "KET",
    readingAttemptId: null,
    listeningAttemptId: null,
    writingAttemptId: null,
    speakingAttemptId: null,
    vocabAttemptId: null,
    grammarAttemptId: null,
    readingStatus: "NOT_STARTED",
    listeningStatus: "NOT_STARTED",
    writingStatus: "NOT_STARTED",
    speakingStatus: "NOT_STARTED",
    vocabStatus: "NOT_STARTED",
    grammarStatus: "NOT_STARTED",
    completedAt: null,
    reportAt: null,
    knowledgePoints: null,
    summary: null,
    perSectionScores: null,
    overallScore: null,
    reportError: null,
    createdAt: new Date("2026-04-19T16:00:00.000Z"),
    updatedAt: new Date("2026-04-19T16:00:00.000Z"),
    ...overrides,
  };
}

// ─── pure decision logic ─────────────────────────────────────────────────────

describe("decideGateState", () => {
  it("returns NEED_GENERATE when row is null", () => {
    expect(decideGateState(null)).toEqual({ kind: "NEED_GENERATE", id: null });
  });

  it("returns IN_PROGRESS for status=PENDING", () => {
    const wd = buildRow({ id: "wd-pending", status: "PENDING" });
    expect(decideGateState(wd)).toEqual({ kind: "IN_PROGRESS", id: "wd-pending" });
  });

  it("returns IN_PROGRESS for status=IN_PROGRESS", () => {
    const wd = buildRow({ id: "wd-running", status: "IN_PROGRESS" });
    expect(decideGateState(wd)).toEqual({ kind: "IN_PROGRESS", id: "wd-running" });
  });

  it("returns UNBLOCKED for status=COMPLETE", () => {
    const wd = buildRow({ id: "wd-complete", status: "COMPLETE" });
    expect(decideGateState(wd)).toEqual({ kind: "UNBLOCKED", id: "wd-complete" });
  });

  it("returns UNBLOCKED for status=REPORT_READY", () => {
    const wd = buildRow({ id: "wd-ready", status: "REPORT_READY" });
    expect(decideGateState(wd)).toEqual({ kind: "UNBLOCKED", id: "wd-ready" });
  });

  it("returns UNBLOCKED for status=REPORT_FAILED (gate is unblocked once submitted; AI report failure does not re-gate)", () => {
    const wd = buildRow({ id: "wd-failed", status: "REPORT_FAILED" });
    expect(decideGateState(wd)).toEqual({ kind: "UNBLOCKED", id: "wd-failed" });
  });
});

// ─── findCurrentWeekDiagnose ─────────────────────────────────────────────────

describe("findCurrentWeekDiagnose", () => {
  it("queries prisma.weeklyDiagnose.findUnique with userId_weekStart compound key", async () => {
    findUnique.mockResolvedValue(null);
    await findCurrentWeekDiagnose("user-1");
    expect(findUnique).toHaveBeenCalledTimes(1);
    const arg = findUnique.mock.calls[0][0];
    expect(arg.where.userId_weekStart.userId).toBe("user-1");
    expect(arg.where.userId_weekStart.weekStart).toBeInstanceOf(Date);
  });

  it("passes through the row when prisma returns one", async () => {
    const row = buildRow({ id: "wd-1", status: "IN_PROGRESS" });
    findUnique.mockResolvedValue(row);
    const out = await findCurrentWeekDiagnose("user-1");
    expect(out).toEqual(row);
  });

  it("returns null when prisma returns null", async () => {
    findUnique.mockResolvedValue(null);
    const out = await findCurrentWeekDiagnose("user-1");
    expect(out).toBeNull();
  });
});

// ─── getRequiredDiagnoseId ───────────────────────────────────────────────────

describe("getRequiredDiagnoseId", () => {
  it("returns NEED_GENERATE_SENTINEL when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBe(NEED_GENERATE_SENTINEL);
    expect(out).toBe("NEED_GENERATE");
  });

  it("returns the wd.id when row is in PENDING status", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-pending", status: "PENDING" }));
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBe("wd-pending");
  });

  it("returns the wd.id when row is in IN_PROGRESS status", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-running", status: "IN_PROGRESS" }));
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBe("wd-running");
  });

  it("returns null when row is in COMPLETE status", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-complete", status: "COMPLETE" }));
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBeNull();
  });

  it("returns null when row is in REPORT_READY status", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-ready", status: "REPORT_READY" }));
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBeNull();
  });

  it("returns null when row is in REPORT_FAILED status (still unblocks)", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-failed", status: "REPORT_FAILED" }));
    const out = await getRequiredDiagnoseId("user-1");
    expect(out).toBeNull();
  });
});

// ─── isCompletedThisWeek ─────────────────────────────────────────────────────

describe("isCompletedThisWeek", () => {
  it("returns false when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    expect(await isCompletedThisWeek("user-1")).toBe(false);
  });

  it("returns false for PENDING", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "PENDING" }));
    expect(await isCompletedThisWeek("user-1")).toBe(false);
  });

  it("returns false for IN_PROGRESS", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "IN_PROGRESS" }));
    expect(await isCompletedThisWeek("user-1")).toBe(false);
  });

  it("returns true for COMPLETE", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "COMPLETE" }));
    expect(await isCompletedThisWeek("user-1")).toBe(true);
  });

  it("returns true for REPORT_READY", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "REPORT_READY" }));
    expect(await isCompletedThisWeek("user-1")).toBe(true);
  });

  it("returns false for REPORT_FAILED (success-only signal — see eligibility.ts header)", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "REPORT_FAILED" }));
    expect(await isCompletedThisWeek("user-1")).toBe(false);
  });
});

// ─── requireUngated ──────────────────────────────────────────────────────────

describe("requireUngated", () => {
  it("redirects to /diagnose when no row exists", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireUngated("user-1")).rejects.toThrow(RedirectError);
    await expect(requireUngated("user-1")).rejects.toThrow("NEXT_REDIRECT:/diagnose");
  });

  it("redirects to /diagnose for PENDING", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "PENDING" }));
    await expect(requireUngated("user-1")).rejects.toThrow("NEXT_REDIRECT:/diagnose");
  });

  it("redirects to /diagnose for IN_PROGRESS", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "IN_PROGRESS" }));
    await expect(requireUngated("user-1")).rejects.toThrow("NEXT_REDIRECT:/diagnose");
  });

  it("returns void (does not throw) for COMPLETE", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "COMPLETE" }));
    await expect(requireUngated("user-1")).resolves.toBeUndefined();
  });

  it("returns void for REPORT_READY", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "REPORT_READY" }));
    await expect(requireUngated("user-1")).resolves.toBeUndefined();
  });

  it("returns void for REPORT_FAILED (still unblocks)", async () => {
    findUnique.mockResolvedValue(buildRow({ id: "wd-1", status: "REPORT_FAILED" }));
    await expect(requireUngated("user-1")).resolves.toBeUndefined();
  });
});

// ─── exported sentinel ───────────────────────────────────────────────────────

describe("NEED_GENERATE_SENTINEL", () => {
  it('exports the literal "NEED_GENERATE" string', () => {
    expect(NEED_GENERATE_SENTINEL).toBe("NEED_GENERATE");
  });
});
