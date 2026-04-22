import { PrismaClient } from "@prisma/client";
import { examPoints } from "./seedData/examPoints";
import { difficultyPoints } from "./seedData/difficultyPoints";

const prisma = new PrismaClient();

async function seedTeacherActivationCodes() {
  const codes = ["TEACHER-DEMO-001", "TEACHER-DEMO-002", "TEACHER-DEMO-003"];
  for (const code of codes) {
    await prisma.teacherActivationCode.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }
  console.log(`Ensured ${codes.length} teacher activation codes (DEMO-001..003)`);
}

async function seedExamPoints() {
  for (const ep of examPoints) {
    await prisma.examPoint.upsert({
      where: { id: ep.id },
      update: {
        examType: ep.examType,
        paperCode: ep.paperCode,
        part: ep.part,
        code: ep.code,
        label: ep.label,
        descriptionZh: ep.descriptionZh,
        skillTags: ep.skillTags,
      },
      create: {
        id: ep.id,
        examType: ep.examType,
        paperCode: ep.paperCode,
        part: ep.part,
        code: ep.code,
        label: ep.label,
        descriptionZh: ep.descriptionZh,
        skillTags: ep.skillTags,
      },
    });
  }
  console.log(`Seeded ${examPoints.length} exam points`);
}

async function seedDifficultyPoints() {
  for (const dp of difficultyPoints) {
    await prisma.difficultyPoint.upsert({
      where: { id: dp.id },
      update: {
        examType: dp.examType,
        code: dp.code,
        label: dp.label,
        descriptionZh: dp.descriptionZh,
        category: dp.category,
      },
      create: {
        id: dp.id,
        examType: dp.examType,
        code: dp.code,
        label: dp.label,
        descriptionZh: dp.descriptionZh,
        category: dp.category,
      },
    });
  }
  console.log(`Seeded ${difficultyPoints.length} difficulty points`);
}

async function main() {
  await seedTeacherActivationCodes();
  await seedExamPoints();
  await seedDifficultyPoints();
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
