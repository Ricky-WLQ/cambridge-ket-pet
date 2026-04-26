/**
 * Reset (delete) the current-week WeeklyDiagnose for the most-recently-active
 * user, so they can re-generate from a clean slate. Used when a previous
 * generate left the Test row stuck (e.g. audioStatus=FAILED before ffmpeg
 * was installed).
 *
 * Cascade chain (per schema):
 *   WeeklyDiagnose.test → Test → TestAttempt[] (cascade delete)
 * So deleting the parent Test row removes everything in one shot.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const wd = await prisma.weeklyDiagnose.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      test: { select: { id: true, audioStatus: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!wd) {
    console.log("No WeeklyDiagnose rows. Nothing to reset.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `Latest WeeklyDiagnose: id=${wd.id} userId=${wd.userId} (${wd.user.email}) status=${wd.status} audioStatus=${wd.test.audioStatus}`,
  );

  // Delete in order to satisfy FK relations:
  //   1. TestAttempt rows (children of Test)
  //   2. WeeklyDiagnose row (FK -> Test, FK -> User)
  //   3. Test row (parent)
  // We do this in a transaction.

  await prisma.$transaction(async (tx) => {
    const attempts = await tx.testAttempt.deleteMany({
      where: { testId: wd.testId },
    });
    console.log(`  deleted ${attempts.count} TestAttempt rows`);

    await tx.weeklyDiagnose.delete({ where: { id: wd.id } });
    console.log(`  deleted WeeklyDiagnose ${wd.id}`);

    await tx.test.delete({ where: { id: wd.testId } });
    console.log(`  deleted Test ${wd.testId}`);
  });

  console.log("\n[OK] Reset complete. The user can click 开始本周诊断 to regenerate.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
