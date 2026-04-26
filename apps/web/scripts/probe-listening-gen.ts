/**
 * Probe: call services/ai's /v1/listening/generate directly with scope=PART, part=1
 * exactly the way production /api/tests/generate does. See what comes back.
 */
import "dotenv/config";

async function main() {
  const url = `${process.env.AI_SERVICE_URL ?? "http://localhost:8001"}/v1/listening/generate`;
  const auth = process.env.INTERNAL_AI_SHARED_SECRET ?? "";
  console.log("POST", url);
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({
      exam_type: "KET",
      scope: "PART",
      part: 1,
      mode: "PRACTICE",
    }),
  });
  console.log(`status=${res.status} after ${Date.now() - t0}ms`);
  const text = await res.text();
  if (!res.ok) {
    console.log("error body:", text.slice(0, 1000));
    return;
  }
  const json = JSON.parse(text);
  console.log("scope:", json.scope, "part:", json.part);
  console.log("parts count:", json.parts?.length);
  for (const p of json.parts ?? []) {
    const segs = p.audio_script ?? [];
    const totalChars = segs.reduce(
      (a: number, s: { text?: string }) => a + (s.text?.length ?? 0),
      0,
    );
    console.log(
      `  part ${p.part_number} kind=${p.kind} segments=${segs.length} totalChars=${totalChars} questions=${p.questions?.length ?? 0}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
