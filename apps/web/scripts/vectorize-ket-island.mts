#!/usr/bin/env node
/**
 * Vectorize the unified KET 岛 raster map into a structured SVG with per-
 * building <g> groups, so each building becomes a pixel-perfect click
 * region.
 *
 * Pipeline:
 *   1. Read /maps/ket-island.png (the user-approved unified illustration)
 *   2. Run imagetracerjs to convert raster → SVG paths
 *   3. Group paths by building bounding box (each path's centroid is
 *      assigned to the building whose bbox contains it)
 *   4. Output /maps/ket-island.svg with <g id="reading">…</g>, etc.,
 *      plus a leftover <g id="bg"> group for terrain/water/sky
 *
 * Building bboxes were eyeballed from the original ket-island.png. They
 * are deliberately tight — we want the path centroid to land inside the
 * box only when it visually belongs to that building. Centroids outside
 * any bbox go into the "bg" group.
 *
 * Run:
 *   pnpm tsx scripts/vectorize-ket-island.mts
 */
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
// imagetracerjs has no first-class types; import via CJS shim
// eslint-disable-next-line @typescript-eslint/no-require-imports
// @ts-expect-error -- imagetracerjs ships no .d.ts
import ImageTracer from "imagetracerjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUB = path.resolve(__dirname, "..", "public");

const SRC = path.join(PUB, "maps", "ket-island.png");
const OUT = path.join(PUB, "maps", "ket-island.svg");

// Building bboxes on the 1024x1024 source. The unified ket-island.png
// the user originally approved has buildings at these approximate
// pixel positions (from visual inspection):
//
//   reading:   pink house, lower-left
//   writing:   yellow café, top-center-left
//   listening: blue studio, top-right
//   speaking:  mint pavilion, center
//   vocab:     alphabet garden, bottom-right
//   grammar:   peach tower, far-right
//
// Bboxes in pixel coords on the 1024x1024 source.
type Bbox = { x1: number; y1: number; x2: number; y2: number };
const BUILDINGS: Record<string, Bbox> = {
  reading: { x1: 30, y1: 380, x2: 360, y2: 720 },
  writing: { x1: 270, y1: 130, x2: 530, y2: 470 },
  listening: { x1: 540, y1: 110, x2: 800, y2: 440 },
  speaking: { x1: 380, y1: 320, x2: 640, y2: 600 },
  vocab: { x1: 600, y1: 600, x2: 950, y2: 880 },
  grammar: { x1: 800, y1: 160, x2: 1024, y2: 660 },
};

const ALL_BUILDING_KEYS = Object.keys(BUILDINGS) as (keyof typeof BUILDINGS)[];

function findBuildingForPoint(cx: number, cy: number): string | null {
  for (const k of ALL_BUILDING_KEYS) {
    const b = BUILDINGS[k];
    if (cx >= b.x1 && cx <= b.x2 && cy >= b.y1 && cy <= b.y2) return k;
  }
  return null;
}

interface TracedPathSegment {
  /** "L" = line, "Q" = quadratic curve. */
  type: "L" | "Q";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3?: number;
  y3?: number;
}

interface TracedPath {
  segments: TracedPathSegment[];
  boundingbox: [number, number, number, number];
  isholepath: boolean;
}

/** imagetracerjs `tracedata.layers` is `TracedPath[][]` — each inner array is one color layer. */
type TracedLayer = TracedPath[];

interface ImageDataLite {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
}

function pathCentroid(p: TracedPath): { x: number; y: number } | null {
  // Use the bounding-box midpoint as the centroid — robust against
  // mixed L/Q segment types and faster than averaging vertices.
  const [x1, y1, x2, y2] = p.boundingbox;
  if (x1 === undefined || x2 === undefined) return null;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

function loadPngAsImageData(filePath: string): ImageDataLite {
  const buf = readFileSync(filePath);
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

async function main() {
  console.log(`reading ${SRC}…`);
  const imgd = loadPngAsImageData(SRC);
  console.log(`tracing ${imgd.width}x${imgd.height} png…`);

  // imagetracerjs options tuned for cartoon illustration (chunky shapes,
  // not photo realism). Reduces the path count and keeps shapes large.
  const options = {
    ltres: 1, // line threshold
    qtres: 1, // quad threshold
    pathomit: 8, // omit paths shorter than this
    rightangleenhance: false,
    colorsampling: 2, // deterministic
    numberofcolors: 24, // palette quantization
    mincolorratio: 0.02,
    colorquantcycles: 3,
    blurradius: 0,
    strokewidth: 1,
    linefilter: false,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
  };

  // imagetracerjs's ImagedataToTracedata returns a tracedata object
  // with layers indexed by color index, each layer has paths.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traced = (ImageTracer as unknown as any).imagedataToTracedata(
    imgd,
    options,
  );
  const layers = traced.layers as TracedLayer[];

  // Bin paths by building bbox.
  const byBuilding: Record<string, string[]> = { bg: [] };
  for (const k of ALL_BUILDING_KEYS) byBuilding[k] = [];

  let totalPaths = 0;
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    if (!layer || layer.length === 0) continue;
    const palette = traced.palette as Array<{ r: number; g: number; b: number; a: number }>;
    const color = palette[li];
    if (!color || color.a < 8) continue; // skip fully transparent

    for (const p of layer) {
      const c = pathCentroid(p);
      if (!c) continue;
      const buildingKey = findBuildingForPoint(c.x, c.y) ?? "bg";

      // Build the SVG path d-string from segments. imagetracerjs uses
      // string types: "L" for line, "Q" for quadratic curve.
      let d = "";
      for (let i = 0; i < p.segments.length; i++) {
        const s = p.segments[i];
        if (s.type === "L") {
          d += i === 0
            ? `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2} `
            : `L ${s.x2} ${s.y2} `;
        } else if (s.type === "Q") {
          d += i === 0
            ? `M ${s.x1} ${s.y1} Q ${s.x2} ${s.y2} ${s.x3} ${s.y3} `
            : `Q ${s.x2} ${s.y2} ${s.x3} ${s.y3} `;
        }
      }
      d += "Z";

      const fill = `rgb(${color.r},${color.g},${color.b})`;
      const fragment = `<path d="${d}" fill="${fill}" />`;
      byBuilding[buildingKey].push(fragment);
      totalPaths++;
    }
  }

  console.log(`traced ${totalPaths} paths across ${layers.length} color layers`);
  for (const k of ["bg", ...ALL_BUILDING_KEYS]) {
    console.log(`  ${k}: ${byBuilding[k].length} paths`);
  }

  // Per-building click-through hrefs. The <g> for each building is
  // wrapped in an <a> so clicking anywhere on the painted pixels of that
  // building (any of its hundreds of paths) navigates to the mode page.
  // Standard HTML — works without JS, full page reload (acceptable for
  // portal-home → mode-page navigation).
  const HREFS: Record<string, string> = {
    reading: "/ket/reading/new",
    writing: "/ket/writing/new",
    listening: "/ket/listening/new",
    speaking: "/ket/speaking/new",
    vocab: "/ket/vocab",
    grammar: "/ket/grammar",
  };
  const ARIA: Record<string, string> = {
    reading: "Reading 阅读",
    writing: "Writing 写作",
    listening: "Listening 听力",
    speaking: "Speaking 口语",
    vocab: "Vocabulary 词汇",
    grammar: "Grammar 语法",
  };

  const groups = ["bg", ...ALL_BUILDING_KEYS]
    .map((k) => {
      const inner = `<g id="${k}">\n    ${byBuilding[k].join("\n    ")}\n  </g>`;
      // bg is decoration only — not clickable.
      if (k === "bg") return `  ${inner}`;
      return `  <a href="${HREFS[k]}" aria-label="${ARIA[k]}" style="cursor:pointer">${inner}</a>`;
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${imgd.width} ${imgd.height}" preserveAspectRatio="xMidYMid slice">
${groups}
</svg>
`;

  writeFileSync(OUT, svg);
  console.log(`wrote ${OUT} (${svg.length.toLocaleString()} bytes)`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
