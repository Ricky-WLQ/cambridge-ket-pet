import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const t = await prisma.test.findFirst({
    where: { kind: "DIAGNOSE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      payload: true,
      audioStatus: true,
      audioErrorMessage: true,
    },
  });
  if (!t) {
    console.log("No DIAGNOSE Test row");
    await prisma.$disconnect();
    return;
  }
  console.log("Test:", t.id, "audioStatus:", t.audioStatus);
  console.log("audioErrorMessage:", t.audioErrorMessage);
  const p = t.payload as {
    sections?: { LISTENING?: { parts?: Array<Record<string, unknown>> } };
  } | null;
  const parts = p?.sections?.LISTENING?.parts ?? [];
  console.log(`\nListening parts: ${parts.length}`);
  for (const part of parts) {
    const audioScript = part.audioScript as Array<{ text?: string }> | undefined;
    const segs = audioScript ?? [];
    const totalChars = segs.reduce((a, s) => a + (s.text?.length ?? 0), 0);
    console.log(
      `  Part ${part.partNumber} kind=${part.kind} segments=${segs.length} totalChars=${totalChars}`,
    );
    for (let i = 0; i < Math.min(segs.length, 5); i++) {
      const s = segs[i];
      console.log(
        `    [${i}] ${(s.text ?? "").slice(0, 60).replace(/\n/g, " ")}${(s.text?.length ?? 0) > 60 ? "..." : ""}  (${s.text?.length ?? 0} chars)`,
      );
    }
    if (segs.length > 5) console.log(`    ...(${segs.length - 5} more)`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
