/**
 * Retry the finalize pipeline against the latest WeeklyDiagnose row,
 * regardless of REPORT_FAILED status (used when something blocked the
 * pipeline mid-flight, e.g. the camelCase prompt bug or missing max_tokens).
 *
 * Usage: pnpm tsx scripts/retry-finalize.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

import { runFinalizePipeline } from "@/lib/diagnose/finalize";

async function main() {
  const prisma = new PrismaClient();
  const wd = await prisma.weeklyDiagnose.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, status: true },
  });
  if (!wd) {
    console.log("No WeeklyDiagnose rows found.");
    await prisma.$disconnect();
    return;
  }
  console.log(`Latest WeeklyDiagnose: ${wd.id} userId=${wd.userId} status=${wd.status}`);

  // Roll back REPORT_FAILED → COMPLETE so the pipeline runs analysis + summary.
  if (wd.status === "REPORT_FAILED") {
    await prisma.weeklyDiagnose.update({
      where: { id: wd.id },
      data: { status: "COMPLETE", reportError: null },
    });
    console.log("Reset status REPORT_FAILED → COMPLETE.");
  }

  console.log("Running finalize pipeline...");
  const t0 = Date.now();
  const result = await runFinalizePipeline(wd.userId);
  console.log(`Done in ${Date.now() - t0}ms. Result:`, JSON.stringify(result, null, 2));

  const after = await prisma.weeklyDiagnose.findUnique({
    where: { id: wd.id },
    select: {
      status: true,
      overallScore: true,
      reportError: true,
      knowledgePoints: true,
      summary: true,
    },
  });
  console.log("\nWeeklyDiagnose after:");
  console.log("  status:", after?.status);
  console.log("  overallScore:", after?.overallScore);
  console.log("  reportError:", after?.reportError);
  console.log(
    "  knowledgePoints count:",
    Array.isArray(after?.knowledgePoints)
      ? (after.knowledgePoints as unknown[]).length
      : "not-array",
  );
  console.log("  summary set?", after?.summary != null);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
