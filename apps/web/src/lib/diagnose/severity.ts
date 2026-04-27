/**
 * Severity computation for KnowledgePointGroups returned by the AI 8-category analysis.
 *
 * The rule is ported verbatim from pretco-app's diagnostic report logic
 * (`pretco-app/src/app/api/diagnostic/[testId]/report/route.ts:178-181`):
 *   - questions.length >= 3 → "critical"
 *   - questions.length === 2 → "moderate"
 *   - else                  → "minor"
 *
 * Why these helpers live here (not on services/ai):
 *  - Severity is a deterministic post-processing rule, not a model decision.
 *    Computing it on apps/web keeps the AI agent's contract narrow (the agent
 *    only owns clustering + lesson copy) and lets us re-derive severity if a
 *    consumer wants to filter or re-bucket without re-calling the AI.
 *  - The same helpers feed both the finalize endpoint (writing severity into
 *    the persisted WeeklyDiagnose.knowledgePoints JSON) and the report UI's
 *    sort order, so they need to be importable from both server and client
 *    code paths — i.e. pure with no Node/Prisma deps.
 *
 * Immutability:
 *  - applySeverity / applySeverityToAll / sortBySeverity all return new objects /
 *    new arrays. The questions array on a group is shared by reference (we never
 *    mutate it) — copying it would just inflate memory for no observable benefit.
 */

import type { KnowledgePointGroup, KnowledgePointSeverity } from "./types";

/**
 * Compute severity from the size of the questions array attached to a
 * knowledge-point group. Defensive: 0 (empty cluster) and any negative
 * value collapse to "minor" — the least-severe bucket — so that a
 * malformed AI response doesn't escalate noise into the critical bucket.
 */
export function computeSeverity(questionCount: number): KnowledgePointSeverity {
  if (questionCount >= 3) return "critical";
  if (questionCount === 2) return "moderate";
  return "minor";
}

/**
 * Apply severity to a single group, returning a new object. The input
 * group and its `questions` array are not mutated. The questions array
 * is shared by reference because we never write to it.
 */
export function applySeverity(group: KnowledgePointGroup): KnowledgePointGroup {
  return {
    ...group,
    severity: computeSeverity(group.questions.length),
  };
}

/**
 * Apply severity to all groups, returning a new array of new objects.
 * Neither the input array nor any input group is mutated.
 */
export function applySeverityToAll(
  groups: KnowledgePointGroup[],
): KnowledgePointGroup[] {
  return groups.map(applySeverity);
}

/** Severity → sort rank (lower = earlier in the output list). */
const SEVERITY_RANK: Record<KnowledgePointSeverity, number> = {
  critical: 0,
  moderate: 1,
  minor: 2,
};

/**
 * Sort groups by severity (critical first, then moderate, then minor),
 * tie-broken by question count descending (more wrong answers first).
 * Returns a new array; the input array and its elements are not mutated.
 *
 * The sort is stable for groups with equal severity AND equal question
 * count (preserving input order) — Array.prototype.sort has been stable
 * in V8/Node since 2018.
 */
export function sortBySeverity(
  groups: KnowledgePointGroup[],
): KnowledgePointGroup[] {
  return [...groups].sort((a, b) => {
    const rankDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDelta !== 0) return rankDelta;
    // Higher question count first within the same severity.
    return b.questions.length - a.questions.length;
  });
}
