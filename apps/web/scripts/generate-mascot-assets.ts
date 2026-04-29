#!/usr/bin/env node
/**
 * One-time idempotent generator for Leo + Aria mascot poses + KET 岛 / PET 城
 * map illustrations. Saves PNGs to apps/web/public/{mascots,maps}/, which
 * Next.js then serves as static assets.
 *
 * Already-existing files are skipped. Override with --force to regenerate.
 *
 * Spec: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §4.1-4.4
 *
 * Run:
 *   pnpm tsx scripts/generate-mascot-assets.ts                # generate missing
 *   pnpm tsx scripts/generate-mascot-assets.ts --force        # regenerate ALL
 *   pnpm tsx scripts/generate-mascot-assets.ts --only=leo     # only Leo poses
 *   pnpm tsx scripts/generate-mascot-assets.ts --only=aria    # only Aria poses
 *   pnpm tsx scripts/generate-mascot-assets.ts --only=maps    # only maps
 *
 * Required env (loaded from services/ai/.env):
 *   SILICONFLOW_API_KEY
 */
import "dotenv/config";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../services/ai/.env") });

const SF_API = "https://api.siliconflow.cn/v1/images/generations";
const SF_MODEL = "Qwen/Qwen-Image";
const REQUEST_TIMEOUT_MS = 180_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const SF_KEY = process.env.SILICONFLOW_API_KEY;
if (!SF_KEY) {
  console.error("FATAL: SILICONFLOW_API_KEY not set in services/ai/.env");
  process.exit(1);
}

const PUB_DIR = path.resolve(__dirname, "../public");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.split("=")[1];

const MASCOT_BASE_LEO =
  "A friendly cartoon fox character mascot named Leo, warm orange fur with creamy white belly and white face accents, big round friendly eyes with sparkles, small black nose, slightly perky pointed ears, flat 2D vector illustration style, vibrant warm colors of orange butter-yellow and soft pink accents, clean solid white background, soft cel-shaded shadows, simple clean rounded shapes, modern professional kid-friendly mascot design similar to Duolingo style";
const MASCOT_BASE_ARIA =
  "A cool cartoon owl character mascot named Aria, soft lavender purple feathers with cream-colored chest, large expressive wise eyes, golden yellow beak, geometric stylized feather patterns, flat 2D vector illustration style, modern teen-friendly color palette of lavender purple sky blue and butter yellow accents, clean solid white background, soft cel-shaded shadows, simple clean rounded geometric shapes, slightly older calm confident wise teen vibe";

interface Pose {
  slug: string;
  verb: string;
}

const POSES: Pose[] = [
  { slug: "greeting", verb: "standing upright facing camera with a gentle warm smile, full body view, friendly approachable expression" },
  { slug: "waving", verb: "standing upright waving one paw or wing in greeting, full body view, cheerful smile" },
  { slug: "reading", verb: "sitting and reading an open book held in front, eyes looking at the page, full body view, calm focused expression" },
  { slug: "listening", verb: "wearing oversized headphones, head tilted slightly, full body view, eyes closed in concentration, peaceful expression" },
  { slug: "writing", verb: "holding a pencil and writing on a small notepad, full body view, focused happy expression" },
  { slug: "microphone", verb: "holding a microphone close to its mouth, full body view, confident expression as if about to speak" },
  { slug: "flashcards", verb: "holding a small stack of flashcards in one paw or wing, presenting them to the viewer, full body view, helpful expression" },
  { slug: "chart", verb: "pointing at a small floating bar chart with a pointer-stick, full body view, teaching expression" },
  { slug: "celebrating", verb: "both arms or wings raised in the air in joyful celebration, full body view, mouth open in happy laugh" },
  { slug: "thinking", verb: "sitting with one paw or wing under chin, eyes looking up, full body view, contemplative expression with question marks floating beside head" },
  { slug: "sleeping", verb: "curled up sleeping with eyes closed, small zzz floating above, full body view in cozy resting pose" },
  { slug: "confused", verb: "head tilted to one side with one paw or wing scratching head, full body view, slightly worried but cute expression" },
];

interface MapTask {
  file: string;
  prompt: string;
  sub: string;
  size: string;
}

const MAPS: MapTask[] = [
  {
    file: "ket-island.png",
    prompt:
      "Cheerful children's storybook illustrated island map viewed from a slight isometric angle, called KET Island, lush green island floating on calm blue water, six distinct themed buildings connected by a winding pastel pebble path: a cozy pink library with stacks of books on the porch, a butter-yellow writing café with a steaming cup sign, a sky-blue music studio with a large headphone icon, a mint-green outdoor stage with a microphone, a lavender purple vocabulary garden with giant alphabet letter flowers, a peach colored grammar tower with friendly archways, fluffy soft white clouds drifting in clear pastel sky, smiling sun in upper corner, palm trees and small bushes, flat 2D vector illustration style, vibrant kid-friendly pastel palette, clean composition, no people, no signs with words, no text, no logos, no watermarks, professional children's book illustration",
    sub: "maps",
    size: "1024x1024",
  },
  {
    file: "pet-city.png",
    prompt:
      "Modern teen-focused stylized city district map viewed from slight isometric angle, called PET City, clean urban skyline with six distinct contemporary landmark buildings connected by sleek pedestrian walkways through a small central park: a glass-walled library with visible bookshelf silhouettes, a chic café with a stylized cup sign, a modernist recording studio with abstract sound-wave decoration, an open-air amphitheater stage with spotlights, a contemporary art museum with abstract alphabet letter sculptures outside, a tall observatory tower with elegant arch motifs, small urban park with stylized trees and benches in the middle, distant city skyline silhouette in background, flat 2D vector illustration style, sophisticated young-adult color palette of lavender purple sky blue butter yellow with ink-black accents and cream highlights, confident contemporary editorial design, no people, no signs with words, no text, no logos, no watermarks, professional editorial illustration",
    sub: "maps",
    size: "1024x1024",
  },
];

interface SfResp {
  images?: Array<{ url?: string }>;
  data?: Array<{ url?: string }>;
}

async function genOne(
  prompt: string,
  outPath: string,
  size: string,
): Promise<boolean> {
  if (!FORCE && existsSync(outPath)) {
    console.log(`SKIP ${path.relative(PUB_DIR, outPath)} (exists)`);
    return true;
  }
  const t0 = Date.now();
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(SF_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SF_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        prompt,
        image_size: size,
        batch_size: 1,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(tm);
  }
  if (!res.ok) {
    console.error(
      `HTTP ${res.status} for ${outPath}: ${(await res.text()).slice(0, 300)}`,
    );
    return false;
  }
  const j = (await res.json()) as SfResp;
  const url = j.images?.[0]?.url ?? j.data?.[0]?.url;
  if (!url) {
    console.error(`no url for ${outPath}`);
    return false;
  }
  const dl = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!dl.ok) {
    console.error(`download ${dl.status} for ${outPath}`);
    return false;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(await dl.arrayBuffer()));
  console.log(`OK ${path.relative(PUB_DIR, outPath)} in ${Date.now() - t0}ms`);
  return true;
}

interface Task {
  prompt: string;
  out: string;
  size: string;
}

async function main() {
  const tasks: Task[] = [];

  if (!ONLY || ONLY === "leo") {
    for (const p of POSES) {
      tasks.push({
        prompt: `${MASCOT_BASE_LEO}, ${p.verb}, no text no logo no watermark, transparent or pure white background`,
        out: path.join(PUB_DIR, "mascots", "leo", `${p.slug}.png`),
        size: "512x512",
      });
    }
  }
  if (!ONLY || ONLY === "aria") {
    for (const p of POSES) {
      tasks.push({
        prompt: `${MASCOT_BASE_ARIA}, ${p.verb}, no text no logo no watermark, transparent or pure white background`,
        out: path.join(PUB_DIR, "mascots", "aria", `${p.slug}.png`),
        size: "512x512",
      });
    }
  }
  if (!ONLY || ONLY === "maps") {
    for (const m of MAPS) {
      tasks.push({
        prompt: m.prompt,
        out: path.join(PUB_DIR, m.sub, m.file),
        size: m.size,
      });
    }
  }

  // Concurrency 4 keeps the SF API within reasonable rate limits.
  const CONCURRENCY = 4;
  let i = 0;
  let okCount = 0;
  let failCount = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (i < tasks.length) {
        const idx = i++;
        const t = tasks[idx];
        const ok = await genOne(t.prompt, t.out, t.size);
        if (ok) okCount++;
        else failCount++;
      }
    }),
  );

  console.log(`\n${okCount}/${tasks.length} succeeded, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
