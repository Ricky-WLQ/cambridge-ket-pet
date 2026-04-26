import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const wd = await prisma.weeklyDiagnose.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, writingAttemptId: true },
  });
  if (!wd?.writingAttemptId) {
    console.log("No writing attemptId");
    await prisma.$disconnect();
    return;
  }
  const a = await prisma.testAttempt.findUnique({
    where: { id: wd.writingAttemptId },
    select: {
      id: true,
      status: true,
      rawScore: true,
      totalPossible: true,
      scaledScore: true,
      weakPoints: true,
      submittedAt: true,
    },
  });
  console.log("Writing attempt:", JSON.stringify(a, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
