import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const wd = await p.weeklyDiagnose.findFirst({
  where: { user: { email: "yc47718@um.edu.mo" } },
  orderBy: { weekStart: "desc" },
});
console.log({
  id: wd.id,
  status: wd.status,
  reportAt: wd.reportAt,
  overallScore: wd.overallScore,
  hasSummary: wd.summary !== null,
  hasKnowledgePoints: wd.knowledgePoints !== null,
});
await p.$disconnect();
