/**
 * In-memory sliding-window rate limiter. Single-process; suitable for a
 * single Zeabur Singapore instance. If we scale to multiple instances,
 * swap the in-memory store for Redis (use the same `rateLimit` signature).
 *
 * Usage:
 *   const r = rateLimit("user-1", { max: 5, windowMs: 60_000 });
 *   if (!r.allowed) return new Response("Too many requests", { status: 429, headers: { "retry-after": String(Math.ceil(r.retryInMs / 1000)) } });
 */

interface Bucket {
  /** Timestamps (ms since epoch) of allowed calls within the current window. */
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  max: number;       // max calls per window
  windowMs: number;  // window duration in ms
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number; // calls left in this window (0 when blocked)
  retryInMs: number; // 0 when allowed; ms until oldest call expires when blocked
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };
  // Drop timestamps older than the window (sliding).
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= opts.max) {
    const oldest = bucket.timestamps[0];
    const retryInMs = oldest + opts.windowMs - now;
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryInMs: Math.max(0, retryInMs) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: opts.max - bucket.timestamps.length,
    retryInMs: 0,
  };
}

/** Test-only: clear all buckets so unit tests are isolated. */
export function _resetForTests(): void {
  buckets.clear();
}
