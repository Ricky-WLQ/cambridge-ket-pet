/**
 * ISO-week boundary helpers in Asia/Shanghai timezone.
 *
 * Why CST (China Standard Time, UTC+8, no DST since 1991):
 *  - All KET/PET users are in mainland China; their "this week" must align
 *    with their local Monday→Sunday calendar, not UTC.
 *  - We never persist wall-clock strings — every boundary is a UTC `Date`
 *    instant so Prisma timestamps stay timezone-agnostic. Only the *anchor*
 *    is computed in CST.
 *
 * Implementation:
 *  - Use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", ... })`
 *    to derive the CST wall-clock y/m/d/weekday for any input instant.
 *  - Compute Monday by subtracting `(dayOfWeek - 1) % 7` days of UTC ms.
 *    This is safe because CST has no DST: subtracting 86_400_000 ms always
 *    moves the CST wall clock back exactly one calendar day.
 *  - Build the UTC instant via `Date.UTC(y, m-1, d, -8, 0, 0, 0)` —
 *    midnight CST is 16:00 UTC of the previous calendar day, and `Date.UTC`
 *    handles the negative-hour underflow for us.
 */

const TIME_ZONE = "Asia/Shanghai";
const MS_PER_DAY = 86_400_000;

type CstParts = {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  /** ISO weekday: Monday=1, ..., Sunday=7. */
  isoDow: number;
  hour: number;   // 0-23
  minute: number; // 0-59
  second: number; // 0-59
};

const cstFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
});

const WEEKDAY_TO_ISO_DOW: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function getCstParts(d: Date): CstParts {
  const parts = cstFormatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  // `Intl.DateTimeFormat` with `hour: "2-digit"` and `hour12: false` can
  // emit "24" as the hour at midnight in some engines (Node ≥ 18 emits
  // "00"; older runtimes emit "24"). Normalize to 0.
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    isoDow: WEEKDAY_TO_ISO_DOW[map.weekday],
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
  };
}

/**
 * Build a UTC `Date` instant from a CST wall-clock date+time.
 * Midnight CST is 16:00 UTC of the previous calendar day, so we pass
 * the CST hour minus 8 to `Date.UTC`, which handles negative underflow.
 */
function cstWallClockToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second, ms));
}

/** Current ISO week start: Monday 00:00:00.000 in Asia/Shanghai, returned as a UTC Date instant. */
export function currentWeekStart(now: Date = new Date()): Date {
  const cst = getCstParts(now);
  // Anchor at CST midnight of the same calendar day, then subtract
  // (isoDow - 1) days to land on Monday. We work in UTC ms because CST
  // has no DST and the day-arithmetic is a flat 86_400_000 ms per day.
  const monMidnightUtc = cstWallClockToUtc(
    cst.year,
    cst.month,
    cst.day,
    0,
    0,
    0,
    0,
  ).getTime();
  return new Date(monMidnightUtc - (cst.isoDow - 1) * MS_PER_DAY);
}

/** Current ISO week end: Sunday 23:59:59.999 in Asia/Shanghai, returned as a UTC Date instant. */
export function currentWeekEnd(now: Date = new Date()): Date {
  const start = currentWeekStart(now);
  // 7 days minus 1 ms = Sunday 23:59:59.999
  return new Date(start.getTime() + 7 * MS_PER_DAY - 1);
}

/** Previous ISO week start: same anchor as currentWeekStart but for the prior week. */
export function previousWeekStart(weekStart: Date): Date {
  // Normalize via currentWeekStart in case the caller passed an arbitrary
  // instant within a week rather than an exact Monday-00:00 anchor.
  const thisMon = currentWeekStart(weekStart);
  return new Date(thisMon.getTime() - 7 * MS_PER_DAY);
}

/** True iff `a` and `b` fall in the same ISO week in Asia/Shanghai. */
export function isSameIsoWeekCST(a: Date, b: Date): boolean {
  return currentWeekStart(a).getTime() === currentWeekStart(b).getTime();
}

/** Format a CST week start date as zh-CN: "2026-04-20 周一 — 04-26 周日" */
export function formatWeekRangeZh(weekStart: Date): string {
  const monStart = currentWeekStart(weekStart);
  // Sunday is +6 days from Monday. Take the wall-clock date of that
  // instant *expressed in CST* (since the result must be the CST
  // calendar Sunday).
  const sunInstant = new Date(monStart.getTime() + 6 * MS_PER_DAY);
  const mon = getCstParts(monStart);
  const sun = getCstParts(sunInstant);
  const pad2 = (n: number) => n.toString().padStart(2, "0");
  return (
    `${mon.year}-${pad2(mon.month)}-${pad2(mon.day)} 周一 — ` +
    `${pad2(sun.month)}-${pad2(sun.day)} 周日`
  );
}
