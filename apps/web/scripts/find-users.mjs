import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const users = await p.user.findMany({ select: { id: true, email: true, name: true, role: true } });
for (const u of users) console.log(`${u.email} (${u.role}) — ${u.name ?? "(no name)"} — ${u.id}`);
await p.$disconnect();
