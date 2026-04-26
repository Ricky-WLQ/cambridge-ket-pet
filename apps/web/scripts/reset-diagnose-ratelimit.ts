import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const result = await prisma.generationEvent.deleteMany({
    where: { bucket: "diagnose_generate" },
  });
  console.log(
    `Deleted ${result.count} GenerationEvent rows (bucket=diagnose_generate)`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
