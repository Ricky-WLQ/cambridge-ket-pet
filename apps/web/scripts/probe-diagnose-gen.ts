/**
 * Probe: call services/ai's /v1/diagnose/generate directly and check the
 * listening sub-response shape. Specifically: does the orchestrator return
 * 1 part (matching scope=PART, part=1) or 5 parts (FULL)?
 */
import "dotenv/config";

async function main() {
  const url = `${process.env.AI_SERVICE_URL ?? "http://localhost:8001"}/v1/diagnose/generate`;
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
      week_start: "2026-04-26",
      focus_areas: [],
    }),
  });
  console.log(`status=${res.status} after ${Date.now() - t0}ms`);
  const text = await res.text();
  if (!res.ok) {
    console.log("error body:", text.slice(0, 1000));
    return;
  }
  const json = JSON.parse(text);
  console.log("Top-level keys:", Object.keys(json));

  const lst = json.listening;
  if (!lst) {
    console.log("listening field MISSING!");
    return;
  }
  console.log("listening.scope:", lst.scope, "listening.part:", lst.part);
  console.log("listening.parts count:", lst.parts?.length);
  for (const p of lst.parts ?? []) {
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
