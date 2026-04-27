/**
 * Standalone kill-orphan-akool.ts — does NOT import @/lib/speaking/akool-client
 * because that file uses `import "server-only"` which trips tsx scripts.
 * Inlines the small bit we need (token + session/close) directly.
 *
 * Loads .env via tsx auto-loading (apps/web/.env is at the working dir's parent).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const AKOOL_BASE = "https://openapi.akool.com";
const GET_TOKEN_URL = `${AKOOL_BASE}/api/open/v3/getToken`;
const SESSION_CLOSE_URL = `${AKOOL_BASE}/api/open/v4/liveAvatar/session/close`;

async function getAkoolToken(): Promise<string> {
  const id = process.env.AKOOL_CLIENT_ID;
  const secret = process.env.AKOOL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("AKOOL_CLIENT_ID / AKOOL_CLIENT_SECRET missing in env");
  }
  const res = await fetch(GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: id, clientSecret: secret }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    token?: string;
    msg?: string;
  };
  if (json.code !== 1000 || !json.token) {
    throw new Error(`Akool token failed: code=${json.code} msg=${json.msg}`);
  }
  return json.token;
}

async function closeSession(token: string, akoolSessionId: string) {
  const res = await fetch(SESSION_CLOSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: akoolSessionId }),
  });
  if (!res.ok) {
    throw new Error(`session/close HTTP ${res.status}`);
  }
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    msg?: string;
  };
  if (json.code !== 1000) {
    console.warn(`  Akool replied code=${json.code} msg=${json.msg} (might already be closed)`);
  }
}

async function main() {
  const prisma = new PrismaClient();

  // Find ALL TestAttempts with non-null akoolSessionId, regardless of status —
  // an "orphan" includes anything still pointing at an Akool session, even
  // attempts in IN_PROGRESS / IDLE / SCORING. We err on the side of
  // closing sessions; if it's already-closed Akool just returns a no-op code.
  const stuck = await prisma.testAttempt.findMany({
    where: { akoolSessionId: { not: null } },
    select: {
      id: true,
      akoolSessionId: true,
      speakingStatus: true,
      startedAt: true,
      submittedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });

  console.log(`Found ${stuck.length} TestAttempt rows with non-null akoolSessionId\n`);

  if (stuck.length === 0) {
    console.log("Nothing to clean up.");
    await prisma.$disconnect();
    return;
  }

  let token: string | null = null;
  try {
    token = await getAkoolToken();
    console.log("[OK] Got Akool token\n");
  } catch (e) {
    console.error("[FAIL] could not get Akool token:", e);
    console.error("Will still scrub the akoolSessionId column locally so the DB doesn't think these are active.");
  }

  let closed = 0;
  let failed = 0;
  for (const a of stuck) {
    const ageMin = (Date.now() - a.startedAt.getTime()) / 60_000;
    console.log(
      `→ attempt=${a.id}  session=${a.akoolSessionId}  status=${a.speakingStatus}  age=${ageMin.toFixed(1)}m`,
    );
    if (token) {
      try {
        await closeSession(token, a.akoolSessionId!);
        console.log("    [OK] Akool session closed");
        closed++;
      } catch (e) {
        console.log(`    [FAIL] close: ${e}`);
        failed++;
      }
    }
    // Clear the akoolSessionId; if speakingStatus is IDLE / IN_PROGRESS,
    // also flip to FAILED so the runner won't think there's a live session.
    // SpeakingStatus enum does NOT have ABANDONED — terminal failures use FAILED.
    const flipToFailed =
      a.speakingStatus === "IDLE" || a.speakingStatus === "IN_PROGRESS";
    await prisma.testAttempt.update({
      where: { id: a.id },
      data: {
        akoolSessionId: null,
        ...(flipToFailed
          ? { speakingStatus: "FAILED" as never, speakingError: "session orphan-closed by kill-orphan-akool.ts" }
          : {}),
      },
    });
    console.log(
      `    [OK] DB scrubbed (akoolSessionId=null${flipToFailed ? ", speakingStatus=FAILED" : ""})`,
    );
  }

  console.log(`\nSummary: ${stuck.length} found, ${closed} successfully closed via Akool, ${failed} close-failures (DB scrubbed regardless)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
