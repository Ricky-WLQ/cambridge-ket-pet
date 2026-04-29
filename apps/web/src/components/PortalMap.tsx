"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Portal } from "@/i18n/voice";

export interface ModeChip {
  mode: "reading" | "listening" | "writing" | "speaking" | "vocab" | "grammar";
  /** Visible chip label (e.g., "📖 读" for KET kid voice or "阅读" for PET teen voice). */
  label: string;
  /**
   * Right-aligned secondary metric (e.g., "84%" accuracy, "312/1599" progress).
   * Optional — omit when no real per-mode metric is computed for the user.
   * Per the no-fabricated-UI-data rule (spec §2.1.1), do NOT pass example
   * values; either pass a real query result or leave undefined.
   */
  accuracy?: string;
  /** Click-through target. */
  href: string;
  /**
   * Path to the building's transparent-background PNG.
   */
  imgSrc: string;
  /**
   * Where the building image is placed on the map, in viewBox coords
   * (the SVG uses viewBox="0 0 100 100" so values are percentages of the
   * square map). x/y is the top-left corner; w/h is the box size.
   */
  placement: { x: number; y: number; w: number; h: number };
  /**
   * Plot center in viewBox coords — used both as the SVG plot anchor
   * (the small platform under the building) AND as a waypoint on the
   * journey path.
   */
  plotCenter: { x: number; y: number };
  /** Where the chip name-tag sits relative to the placement box. */
  labelAnchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center";
  /** Renders the chip name-tag in the highlighted ink-black variant. */
  active?: boolean;
  /**
   * Ordinal in the learning path (1-based). Renders as a small numbered
   * badge inside the chip name-tag.
   */
  order?: number;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  /** Optional override for the map image alt text. */
  alt?: string;
  /**
   * Debug mode — when true, opaque-pixel click regions are tinted via a
   * SVG <feColorMatrix> filter so the hit area is visibly highlighted.
   */
  debug?: boolean;
}

const ANCHOR_POSITION: Record<NonNullable<ModeChip["labelAnchor"]>, string> = {
  "top-left": "top-1 left-1",
  "top-right": "top-1 right-1",
  "bottom-left": "bottom-1 left-1",
  "bottom-right": "bottom-1 right-1",
  "top-center": "top-1 left-1/2 -translate-x-1/2",
};

const DEBUG_FILTER_ID: Record<ModeChip["mode"], string> = {
  reading: "ket-debug-reading",
  writing: "ket-debug-writing",
  listening: "ket-debug-listening",
  speaking: "ket-debug-speaking",
  vocab: "ket-debug-vocab",
  grammar: "ket-debug-grammar",
};

const DEBUG_TINT: Record<ModeChip["mode"], { r: number; g: number; b: number }> = {
  reading: { r: 1.0, g: 0.0, b: 0.5 },
  writing: { r: 1.0, g: 0.7, b: 0.0 },
  listening: { r: 0.0, g: 0.3, b: 1.0 },
  speaking: { r: 0.0, g: 0.8, b: 0.4 },
  vocab: { r: 0.6, g: 0.0, b: 1.0 },
  grammar: { r: 1.0, g: 0.4, b: 0.0 },
};

/**
 * Build a smooth winding-path `<path>` `d` string through the chips'
 * plotCenters in their order. Uses quadratic Bézier curves so the path
 * reads as a continuous road rather than a polyline.
 */
function buildPathD(chips: ModeChip[]): string {
  if (chips.length === 0) return "";
  const pts = chips.map((c) => c.plotCenter);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    // Control point sits midway between prev and curr but offset
    // perpendicular to the line, alternating sides for a natural zigzag.
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    const swing = i % 2 === 0 ? -6 : 6;
    const cx = mx + swing;
    const cy = my;
    d += ` Q ${cx} ${cy} ${curr.x} ${curr.y}`;
  }
  return d;
}

/**
 * Portal-aware map composite with pixel-perfect building click areas
 * arranged along a learning-path road.
 *
 * Layers:
 *   1. <image> empty island scenery (no plots, no paths — just terrain)
 *   2. <path> dotted-pebble road weaving through the 6 plotCenters in
 *      learning order (1=词汇 at top → 6=写 at bottom)
 *   3. <ellipse> grass plot disc under each building
 *   4. 6 building <image>s with pointer-events="visiblePainted" — pixel-
 *      perfect click registration on alpha-opaque pixels
 *   5. DOM <Link> chip name-tags overlaid on top for typography
 *
 * Why client component: SVG <image onClick> uses useRouter() to keep
 * Next.js client-side navigation. The chip name-tag <Link>s remain pure
 * DOM links so keyboard tab order picks them up via focus-visible.
 */
export function PortalMap({
  portal,
  chips,
  alt,
  debug = false,
}: PortalMapProps) {
  const router = useRouter();
  const bgSrc =
    portal === "ket" ? "/maps/ket-island-bg.png" : "/maps/pet-city.png";
  const defaultAlt = portal === "ket" ? "KET 岛" : "PET 城";
  const pathD = buildPathD(chips);

  return (
    <div
      className="stitched-card relative w-full aspect-square overflow-hidden rounded-2xl"
      role="img"
      aria-label={alt ?? defaultAlt}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {chips.map((c) => {
            const tint = DEBUG_TINT[c.mode];
            return (
              <filter
                key={c.mode}
                id={DEBUG_FILTER_ID[c.mode]}
                x="0"
                y="0"
                width="100%"
                height="100%"
              >
                <feColorMatrix
                  type="matrix"
                  values={`0 0 0 0 ${tint.r}  0 0 0 0 ${tint.g}  0 0 0 0 ${tint.b}  0 0 0 0.65 0`}
                />
              </filter>
            );
          })}
        </defs>

        {/* Layer 1: empty island scenery */}
        <image
          href={bgSrc}
          x="0"
          y="0"
          width="100"
          height="100"
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Layer 2: dotted-pebble learning road. Two strokes layered
            for visibility: a thin warm-cream halo behind a thicker
            peach-pink dotted stroke. */}
        <path
          d={pathD}
          fill="none"
          stroke="#fff7e8"
          strokeWidth="4.2"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d={pathD}
          fill="none"
          stroke="#FF9FB6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="0.6 3.2"
        />

        {/* Layer 3: small grass plot disc anchoring each building.
            Slightly darker than the bg grass so the building sits on a
            visible patch rather than floating. */}
        {chips.map((c) => (
          <ellipse
            key={`plot-${c.mode}`}
            cx={c.plotCenter.x}
            cy={c.plotCenter.y + 6}
            rx="11"
            ry="3.5"
            fill="rgba(50, 110, 60, 0.25)"
          />
        ))}

        {/* Layer 4: per-building click images. visiblePainted = pointer
            events fire only on opaque pixels → pixel-perfect click areas.
            outline:none suppresses the harsh browser focus frame. */}
        {chips.map((c) => (
          <image
            key={c.mode}
            href={c.imgSrc}
            x={c.placement.x}
            y={c.placement.y}
            width={c.placement.w}
            height={c.placement.h}
            preserveAspectRatio="xMidYMid meet"
            style={{
              pointerEvents: "visiblePainted",
              cursor: "pointer",
              outline: "none",
            }}
            filter={debug ? `url(#${DEBUG_FILTER_ID[c.mode]})` : undefined}
            role="link"
            aria-label={c.label}
            tabIndex={0}
            onClick={() => router.push(c.href)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(c.href);
              }
            }}
          />
        ))}
      </svg>

      {/* Layer 5: DOM chip name-tag overlays. Decorative redundant
          click target. Keyboard nav covered by SVG <image> tabIndex;
          these are aria-hidden. */}
      {chips.map((c) => {
        const anchor = c.labelAnchor ?? "top-center";
        const wrapStyle: React.CSSProperties = {
          left: `${c.placement.x}%`,
          top: `${c.placement.y}%`,
          width: `${c.placement.w}%`,
          height: `${c.placement.h}%`,
        };
        return (
          <div
            key={c.mode}
            className="pointer-events-none absolute"
            style={wrapStyle}
          >
            <Link
              href={c.href}
              aria-hidden="true"
              tabIndex={-1}
              className={`pointer-events-auto absolute inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 px-2 py-1 text-[0.7rem] font-extrabold shadow-sm motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 ${
                c.active
                  ? "bg-ink text-white border-ink/70"
                  : "bg-white/95 border-ink/30 text-ink"
              } ${ANCHOR_POSITION[anchor]}`}
            >
              {c.order !== undefined && (
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[0.55rem] font-extrabold ${
                    c.active ? "bg-white text-ink" : "bg-ink/85 text-white"
                  }`}
                >
                  {c.order}
                </span>
              )}
              <span>{c.label}</span>
              {c.accuracy !== undefined && (
                <span
                  className={`text-[0.6rem] font-bold ${
                    c.active ? "opacity-100" : "opacity-55"
                  }`}
                >
                  {c.accuracy}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
