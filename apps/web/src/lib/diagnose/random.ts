/**
 * Random-sampling helpers for the diagnose generator.
 *
 * Why a dedicated module:
 *  - The diagnose vocab + grammar bank-sampling steps both shuffle a
 *    candidate pool of ~60 rows down to 3 picks. Using `Math.random() - 0.5`
 *    as the comparator function (the v1 implementation) is biased — it does
 *    NOT produce a uniform permutation, because `Array.prototype.sort` is
 *    not guaranteed to call the comparator a consistent number of times for
 *    each pair. With 60-element arrays this skew is observable and means
 *    the same Word/GrammarQuestion ids are over-represented in diagnose
 *    picks across a class.
 *  - Fisher-Yates is the textbook fix: a single in-place pass that yields
 *    a uniform random permutation. Co-locating it here lets future
 *    diagnose code (e.g., per-week speaking prompts, mock test seeding)
 *    reuse the same correctly-implemented helper.
 */

/**
 * Return a new array containing the elements of `arr` in a uniformly random
 * order. Does not mutate the input. O(n) time, O(n) space.
 *
 * Implements the Fisher-Yates (Knuth) shuffle.
 */
export function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
