/**
 * Run `fn` on each item in `items` with a maximum of `concurrency` in-flight at once.
 * Preserves input order in the returned results array.
 *
 * Uses a worker-pool pattern (not strict batches) — as soon as one worker finishes,
 * it picks up the next pending item. A single slow item doesn't block others.
 *
 * On the first rejection, remaining workers stop picking up new items but every
 * in-flight call is awaited before the rejection is rethrown. This avoids races
 * where the caller's `finally` block cleans up shared state (e.g. a temp dir)
 * while stragglers are still writing to it, producing unhandled rejections.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let firstError: { err: unknown } | undefined;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (!firstError) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        if (!firstError) firstError = { err };
        return;
      }
    }
  });
  await Promise.all(workers);
  if (firstError) throw firstError.err;
  return results;
}
