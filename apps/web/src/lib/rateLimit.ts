import { prisma } from "./prisma";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
};

/**
 * Per-user, per-bucket rate limit backed by the GenerationEvent table.
 * Rolling 1-hour window.
 *
 * On `allowed: true` a new GenerationEvent row IS inserted.
 * On `allowed: false` nothing is written.
 *
 * There is a benign narrow race (count + create are not fully atomic), so
 * at the very edge of the limit an extra call may slip through. Acceptable
 * at our scale; tighten with a CTE-based atomic query if abuse is observed.
 */
export async function checkAndRecordGeneration(
  userId: string,
  bucket: string,
  hourlyLimit: number,
): Promise<RateLimitResult> {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = Date.now();
  const windowStart = new Date(now - ONE_HOUR_MS);

  const count = await prisma.generationEvent.count({
    where: { userId, bucket, createdAt: { gt: windowStart } },
  });

  if (count >= hourlyLimit) {
    return {
      allowed: false,
      count,
      limit: hourlyLimit,
      resetAt: new Date(now + ONE_HOUR_MS),
    };
  }

  await prisma.generationEvent.create({
    data: { userId, bucket },
  });

  return {
    allowed: true,
    count: count + 1,
    limit: hourlyLimit,
    resetAt: new Date(now + ONE_HOUR_MS),
  };
}
