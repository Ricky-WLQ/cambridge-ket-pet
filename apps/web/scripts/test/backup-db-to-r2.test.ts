import { describe, it, expect } from "vitest";
import { computeKeysToDelete } from "../backup-db-to-r2";

describe("computeKeysToDelete", () => {
  it("keeps last 7 daily, deletes older", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/daily/2026-04-27.sql.gz",
      "db-backups/daily/2026-04-26.sql.gz",
      "db-backups/daily/2026-04-25.sql.gz",
      "db-backups/daily/2026-04-24.sql.gz",
      "db-backups/daily/2026-04-23.sql.gz",
      "db-backups/daily/2026-04-22.sql.gz",
      "db-backups/daily/2026-04-21.sql.gz",
      "db-backups/daily/2026-04-20.sql.gz", // 8th — should be deleted
      "db-backups/daily/2026-04-15.sql.gz", // older — should be deleted
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/daily/2026-04-20.sql.gz");
    expect(toDelete).toContain("db-backups/daily/2026-04-15.sql.gz");
    expect(toDelete).not.toContain("db-backups/daily/2026-04-21.sql.gz");
  });
  it("keeps last 4 weekly, deletes older", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/weekly/2026-W17.sql.gz",
      "db-backups/weekly/2026-W16.sql.gz",
      "db-backups/weekly/2026-W15.sql.gz",
      "db-backups/weekly/2026-W14.sql.gz",
      "db-backups/weekly/2026-W13.sql.gz", // 5th — delete
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/weekly/2026-W13.sql.gz");
    expect(toDelete).not.toContain("db-backups/weekly/2026-W14.sql.gz");
  });
  it("keeps last 12 monthly", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/monthly/2026-04.sql.gz",
      "db-backups/monthly/2026-03.sql.gz",
      "db-backups/monthly/2026-02.sql.gz",
      "db-backups/monthly/2026-01.sql.gz",
      "db-backups/monthly/2025-12.sql.gz",
      "db-backups/monthly/2025-11.sql.gz",
      "db-backups/monthly/2025-10.sql.gz",
      "db-backups/monthly/2025-09.sql.gz",
      "db-backups/monthly/2025-08.sql.gz",
      "db-backups/monthly/2025-07.sql.gz",
      "db-backups/monthly/2025-06.sql.gz",
      "db-backups/monthly/2025-05.sql.gz",
      "db-backups/monthly/2025-04.sql.gz", // 13th — delete
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/monthly/2025-04.sql.gz");
    expect(toDelete).not.toContain("db-backups/monthly/2025-05.sql.gz");
  });
});
