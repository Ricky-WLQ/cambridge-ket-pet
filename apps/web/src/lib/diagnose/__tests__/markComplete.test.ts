/**
 * Tests for the shared maybeMarkDiagnoseComplete helper.
 *
 * The helper is the single source of truth for the "all 6 sections done?"
 * gate-release logic. Both the diagnose section submit route and the
 * speaking submit route call it after writing to a section status mirror.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weeklyDiagnose: {
      findUnique: (...a: unknown[]) => findUnique(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

import { maybeMarkDiagnoseComplete } from "../markComplete";

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
});

const TERMINAL = ["SUBMITTED", "GRADED", "AUTO_SUBMITTED"] as const;

function allTerminal(status: string = "PENDING") {
  return {
    readingStatus: "GRADED",
    listeningStatus: "GRADED",
    writingStatus: "SUBMITTED",
    speakingStatus: "SUBMITTED",
    vocabStatus: "GRADED",
    grammarStatus: "GRADED",
    status,
  };
}

describe("maybeMarkDiagnoseComplete", () => {
  it("flips status=COMPLETE when all 6 sections terminal", async () => {
    findUnique.mockResolvedValue(allTerminal("PENDING"));
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "wd-1" },
      data: expect.objectContaining({
        status: "COMPLETE",
        completedAt: expect.any(Date),
      }),
    });
  });

  it("no-op when row is missing", async () => {
    findUnique.mockResolvedValue(null);
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("no-op when status is already COMPLETE (idempotent)", async () => {
    findUnique.mockResolvedValue(allTerminal("COMPLETE"));
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("no-op when status is REPORT_READY (does not regress)", async () => {
    findUnique.mockResolvedValue(allTerminal("REPORT_READY"));
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("no-op when status is REPORT_FAILED (does not regress)", async () => {
    findUnique.mockResolvedValue(allTerminal("REPORT_FAILED"));
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("no-op when one section is still IN_PROGRESS", async () => {
    findUnique.mockResolvedValue({
      ...allTerminal("PENDING"),
      grammarStatus: "IN_PROGRESS",
    });
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it("no-op when one section is NOT_STARTED", async () => {
    findUnique.mockResolvedValue({
      ...allTerminal("PENDING"),
      vocabStatus: "NOT_STARTED",
    });
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).not.toHaveBeenCalled();
  });

  it.each(TERMINAL)("counts %s as a terminal section status", async (status) => {
    // Set every section to the same terminal value.
    findUnique.mockResolvedValue({
      readingStatus: status,
      listeningStatus: status,
      writingStatus: status,
      speakingStatus: status,
      vocabStatus: status,
      grammarStatus: status,
      status: "PENDING",
    });
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("works from IN_PROGRESS overall status (the speaking-finishes-last path)", async () => {
    // The diagnose row may be in IN_PROGRESS when the LAST submit comes in
    // (e.g., user cleared 5 sections, opens speaking last). The helper
    // must still flip from IN_PROGRESS → COMPLETE.
    findUnique.mockResolvedValue(allTerminal("IN_PROGRESS"));
    await maybeMarkDiagnoseComplete("wd-1");
    expect(update).toHaveBeenCalledWith({
      where: { id: "wd-1" },
      data: expect.objectContaining({ status: "COMPLETE" }),
    });
  });
});
