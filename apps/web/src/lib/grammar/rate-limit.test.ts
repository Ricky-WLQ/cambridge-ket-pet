import { describe, expect, it, beforeEach } from "vitest";
import { rateLimit, _resetForTests } from "./rate-limit";

beforeEach(() => _resetForTests());

describe("rateLimit", () => {
  it("allows the first N calls within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("user-1", { max: 5, windowMs: 60_000 })).toEqual({
        allowed: true, remaining: 5 - i - 1, retryInMs: 0,
      });
    }
  });

  it("rejects the (N+1)th call within the window with retryInMs > 0", () => {
    for (let i = 0; i < 5; i++) rateLimit("user-1", { max: 5, windowMs: 60_000 });
    const result = rateLimit("user-1", { max: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryInMs).toBeGreaterThan(0);
    expect(result.retryInMs).toBeLessThanOrEqual(60_000);
  });

  it("buckets per-user (user-2 isn't blocked by user-1's calls)", () => {
    for (let i = 0; i < 5; i++) rateLimit("user-1", { max: 5, windowMs: 60_000 });
    expect(rateLimit("user-2", { max: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("expires entries after windowMs (sliding window)", async () => {
    rateLimit("user-1", { max: 1, windowMs: 30 });
    expect(rateLimit("user-1", { max: 1, windowMs: 30 }).allowed).toBe(false);
    // Wait > 30ms for the window to slide.
    await new Promise((r) => setTimeout(r, 50));
    expect(rateLimit("user-1", { max: 1, windowMs: 30 }).allowed).toBe(true);
  });
});
