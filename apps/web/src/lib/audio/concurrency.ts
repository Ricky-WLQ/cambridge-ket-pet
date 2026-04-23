/**
 * Run `fn` on each item in `items` with a maximum of `concurrency` in-flight at once.
 * Preserves input order in the returned results array.
 *
 * Uses a worker-pool pattern (not strict batches) — as soon as one worker finishes,
 * it picks up the next pending item. A single slow item doesn't block others.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
