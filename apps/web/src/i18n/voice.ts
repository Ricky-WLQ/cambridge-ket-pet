/**
 * Per-portal voice helper. A `Tone<T>` is either:
 *  - A plain T (when both portals share the same value), or
 *  - An object `{ ket: T; pet: T }` (when the portals differ).
 *
 * Use `pickTone(value, portal)` to resolve to a concrete T at render time.
 */
export type Portal = "ket" | "pet";

export type Tone<T = string> = T | { ket: T; pet: T };

export function pickTone<T>(value: Tone<T>, portal: Portal): T {
  if (
    typeof value === "object" &&
    value !== null &&
    "ket" in (value as object) &&
    "pet" in (value as object)
  ) {
    return (value as { ket: T; pet: T })[portal];
  }
  return value as T;
}
