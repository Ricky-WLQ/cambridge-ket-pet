import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const wd = await prisma.weeklyDiagnose.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      test: {
        select: { id: true, audioStatus: true, audioErrorMessage: true },
      },
    },
  });
  console.log("latest WeeklyDiagnose:", wd?.id);
  console.log("  status:", wd?.status);
  console.log("  testId:", wd?.testId);
  console.log("  audioStatus:", wd?.test.audioStatus);
  console.log("  audioErrorMessage:", wd?.test.audioErrorMessage);
  console.log(
    "  R:", wd?.readingStatus,
    " L:", wd?.listeningStatus,
    " W:", wd?.writingStatus,
    " S:", wd?.speakingStatus,
    " V:", wd?.vocabStatus,
    " G:", wd?.grammarStatus,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
