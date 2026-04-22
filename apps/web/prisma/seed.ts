import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const code = await prisma.teacherActivationCode.upsert({
    where: { code: "TEACHER-DEMO-001" },
    update: {},
    create: { code: "TEACHER-DEMO-001" },
  });
  console.log(`Seeded teacher activation code: ${code.code}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
