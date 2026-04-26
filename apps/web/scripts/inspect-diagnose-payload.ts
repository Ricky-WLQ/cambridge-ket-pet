import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const wd = await prisma.weeklyDiagnose.findFirst({
    orderBy: { createdAt: "desc" },
    include: { test: { select: { payload: true } } },
  });
  if (!wd) {
    console.log("No WeeklyDiagnose rows");
    await prisma.$disconnect();
    return;
  }
  console.log("Latest WeeklyDiagnose:", wd.id, "testId:", wd.testId);
  const payload = wd.test.payload as { sections?: Record<string, unknown> } | null;
  if (!payload?.sections) {
    console.log("Test.payload.sections is empty");
    await prisma.$disconnect();
    return;
  }
  const reading = payload.sections.READING as { passage?: string; questions?: unknown[] } | undefined;
  console.log("\nREADING section:");
  console.log("  passage length:", reading?.passage?.length ?? 0);
  console.log("  questions count:", reading?.questions?.length ?? 0);
  if (reading?.questions?.length) {
    console.log("  first question:", JSON.stringify(reading.questions[0], null, 2));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
