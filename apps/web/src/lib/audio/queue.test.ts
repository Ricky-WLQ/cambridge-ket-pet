import { describe, expect, it } from "vitest";
import { createSemaphore, QueueFullError } from "./queue";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("createSemaphore", () => {
  it("allows up to `maxConcurrent` tasks in parallel", async () => {
    const sem = createSemaphore({ maxConcurrent: 2, maxWaiting: 5 });
    let active = 0;
    let peak = 0;

    const task = async () => {
      await sem.acquire();
      try {
        active++;
        peak = Math.max(peak, active);
        await wait(20);
      } finally {
        active--;
        sem.release();
      }
    };

    await Promise.all([task(), task(), task(), task()]);
    expect(peak).toBe(2);
  });

  it("rejects with QueueFullError when waiting queue exceeded", async () => {
    const sem = createSemaphore({ maxConcurrent: 1, maxWaiting: 1 });

    // Take the one slot
    await sem.acquire();

    // This one queues (OK — we have maxWaiting=1)
    const p1 = sem.acquire();
    // This one must reject immediately
    await expect(sem.acquire()).rejects.toBeInstanceOf(QueueFullError);

    sem.release();
    await p1;
    sem.release();
  });
});
