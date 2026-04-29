#!/usr/bin/env node
/**
 * Reports every hardcoded Chinese string in apps/web/src/{**}/*.{ts,tsx}
 * (skipping the i18n source-of-truth and __tests__ folders) plus
 * apps/web/src/app/api/{**}/route.ts that's not in the allowlist.
 *
 * Used by:
 *   - Local: pnpm tsx scripts/audit-hardcoded-zh.ts
 *   - CI:    .github/workflows/audit-hardcoded-zh.yml
 *
 * Exit codes:
 *   0 — zero violations
 *   1 — violations found (printed by file)
 *
 * Source: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §5.3
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_WEB_ROOT = join(__dirname, "..");
const SRC_ROOT = join(APP_WEB_ROOT, "src");

const CHINESE = /[一-鿿]/;
const ALLOWED = new Set([
  "KET",
  "PET",
  "A2 Key",
  "B1 Preliminary",
  "Reading",
  "Listening",
  "Writing",
  "Speaking",
  "Vocab",
  "Grammar",
  "Mina",
  "Leo",
  "Aria",
]);

// Skip these directories/filenames anywhere in the tree.
const SKIP_NAMES = ["__tests__", "node_modules", ".next", "dist", "build"];
// Skip the i18n source-of-truth file (it's allowed to contain Chinese).
const SKIP_FILES = new Set([
  join(SRC_ROOT, "i18n", "zh-CN.ts"),
  join(SRC_ROOT, "i18n", "banned-phrases.ts"),
]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_NAMES.includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(name)) {
      if (SKIP_FILES.has(p)) continue;
      yield p;
    }
  }
}

function fragmentAllowed(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return true;
  if (!CHINESE.test(t)) return true;
  return ALLOWED.has(t);
}

const violations: Record<string, { line: number; text: string }[]> = {};

for (const file of walk(SRC_ROOT)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((ln, i) => {
    // Skip pure comment lines (rough heuristic — JSDoc / // comments).
    if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;
    // Find quoted Chinese substrings.
    const matches = ln.match(/"[^"]*[一-鿿][^"]*"/g) ?? [];
    matches.forEach((m) => {
      if (!fragmentAllowed(m.slice(1, -1))) {
        const rel = relative(APP_WEB_ROOT, file);
        violations[rel] ??= [];
        violations[rel].push({ line: i + 1, text: m.slice(0, 80) });
      }
    });
  });
}

let total = 0;
for (const [file, hits] of Object.entries(violations)) {
  console.log(`\n${file}`);
  for (const h of hits) {
    console.log(`  L${h.line}: ${h.text}`);
    total++;
  }
}

if (total === 0) {
  console.log("✓ no hardcoded Chinese strings found");
  process.exit(0);
} else {
  console.error(
    `\n✗ ${total} hardcoded Chinese strings across ${Object.keys(violations).length} files`,
  );
  process.exit(1);
}
