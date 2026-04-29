// One-shot helper: reset the current-week WeeklyDiagnose row for the
// currently-active user so the next /diagnose visit re-triggers
// runFinalizePipeline against the now-banned-phrase-validating agents.
//
// Sets status back to COMPLETE and clears the report fields. The hub
// page does the rest on first render.
import { PrismaClient } from "@prisma/client";

const userEmail = process.argv[2];
if (!userEmail) {
  console.error("usage: node refinalize-user-diagnose.mjs <userEmail>");
  process.exit(1);
}

const p = new PrismaClient();

const user = await p.user.findUnique({ where: { email: userEmail } });
if (!user) {
  console.error("no user with email:", userEmail);
  process.exit(1);
}

// Newest WeeklyDiagnose row — likely current week.
const wd = await p.weeklyDiagnose.findFirst({
  where: { userId: user.id },
  orderBy: { weekStart: "desc" },
});
if (!wd) {
  console.error("no WeeklyDiagnose for user", user.id);
  process.exit(1);
}

console.log("found row:", {
  id: wd.id,
  weekStart: wd.weekStart.toISOString().slice(0, 10),
  status: wd.status,
  reportAt: wd.reportAt,
});

const updated = await p.weeklyDiagnose.update({
  where: { id: wd.id },
  data: {
    status: "COMPLETE",
    reportAt: null,
    summary: null,
    knowledgePoints: null,
    overallScore: null,
    perSectionScores: null,
    reportError: null,
  },
});

console.log("reset to COMPLETE / reportAt=null. visit /diagnose to re-finalize.");
console.log("updated:", { id: updated.id, status: updated.status });

await p.$disconnect();
