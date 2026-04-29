// Scan persisted database content for banned phrases. Lists every row+
// field that contains any of the banned exam-cram terms, so we know
// whether more reports beyond the user's current week need re-finalize.
import { PrismaClient } from "@prisma/client";

const BANNED = [
  "决定通过率",
  "属于低分段",
  "未达标",
  "短板",
  "critical 弱项",
  "moderate 弱项",
  "minor 弱项",
  "请重视",
  "切记",
  "不容忽视",
  "亟待提升",
  "[critical]",
  "[moderate]",
  "[minor]",
];

function findBanned(s) {
  if (typeof s !== "string") return [];
  return BANNED.filter((p) => s.includes(p));
}
function scan(label, value, hits) {
  if (value == null) return;
  if (typeof value === "string") {
    const m = findBanned(value);
    if (m.length) hits.push({ label, banned: m, sample: value.slice(0, 120) });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scan(`${label}[${i}]`, v, hits));
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) scan(`${label}.${k}`, v, hits);
  }
}

const p = new PrismaClient();

const wds = await p.weeklyDiagnose.findMany({
  select: { id: true, userId: true, weekStart: true, summary: true, knowledgePoints: true },
});
console.log(`scanning ${wds.length} WeeklyDiagnose rows...`);
let totalHits = 0;
for (const wd of wds) {
  const hits = [];
  scan("summary", wd.summary, hits);
  scan("knowledgePoints", wd.knowledgePoints, hits);
  if (hits.length) {
    totalHits += hits.length;
    console.log(`\n[WeeklyDiagnose ${wd.id} — week ${wd.weekStart.toISOString().slice(0, 10)}, user ${wd.userId}]`);
    for (const h of hits) console.log(`  ${h.label}: ${h.banned.join(", ")}`);
    for (const h of hits) console.log(`    "${h.sample.replace(/\n/g, " ")}"`);
  }
}
console.log(`\n=== TestAttempt.weakPoints scan ===`);
const attempts = await p.testAttempt.findMany({
  select: { id: true, weakPoints: true, transcript: true, rubricScores: true },
});
console.log(`scanning ${attempts.length} TestAttempt rows...`);
let attemptHits = 0;
for (const a of attempts) {
  const hits = [];
  scan("weakPoints", a.weakPoints, hits);
  scan("transcript", a.transcript, hits);
  scan("rubricScores", a.rubricScores, hits);
  if (hits.length) {
    attemptHits += hits.length;
    console.log(`[TestAttempt ${a.id}]`);
    for (const h of hits) console.log(`  ${h.label}: ${h.banned.join(", ")}`);
  }
}
console.log(`\n=== SUMMARY ===`);
console.log(`WeeklyDiagnose hits: ${totalHits}`);
console.log(`TestAttempt hits: ${attemptHits}`);

await p.$disconnect();
