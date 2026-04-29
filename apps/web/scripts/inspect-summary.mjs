import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const wd = await p.weeklyDiagnose.findFirst({
  where: { user: { email: "yc47718@um.edu.mo" } },
  orderBy: { weekStart: "desc" },
});
console.log("status:", wd.status, "reportAt:", wd.reportAt);
console.log("\n=== summary ===");
console.log(JSON.stringify(wd.summary, null, 2));
await p.$disconnect();
