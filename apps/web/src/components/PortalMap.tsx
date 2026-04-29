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
   * Path to the building's transparent-background PNG (e.g.
   * `/maps/buildings/ket/reading.png`). The building's alpha channel
   * defines the click region — pointer events register only on opaque
   * pixels via SVG's `pointer-events="visiblePainted"`.
   */
  imgSrc: string;
  /**
   * Where the building image is placed on the map, in viewBox coords
   * (the SVG uses viewBox="0 0 100 100" so values are percentages of the
   * square map). x/y is the top-left corner; w/h is the box size.
   */
  placement: { x: number; y: number; w: number; h: number };
  /** Where the chip name-tag sits relative to the placement box. */
  labelAnchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Renders the chip name-tag in the highlighted ink-black variant. */
  active?: boolean;
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
};

/** Per-mode debug filter id — applied to the building <image> in debug mode. */
const DEBUG_FILTER_ID: Record<ModeChip["mode"], string> = {
  reading: "ket-debug-reading",
  writing: "ket-debug-writing",
  listening: "ket-debug-listening",
  speaking: "ket-debug-speaking",
  vocab: "ket-debug-vocab",
  grammar: "ket-debug-grammar",
};

/** Building tints in debug mode. */
const DEBUG_TINT: Record<ModeChip["mode"], { r: number; g: number; b: number }> = {
  reading: { r: 1.0, g: 0.0, b: 0.5 }, // pink
  writing: { r: 1.0, g: 0.7, b: 0.0 }, // amber
  listening: { r: 0.0, g: 0.3, b: 1.0 }, // blue
  speaking: { r: 0.0, g: 0.8, b: 0.4 }, // green
  vocab: { r: 0.6, g: 0.0, b: 1.0 }, // purple
  grammar: { r: 1.0, g: 0.4, b: 0.0 }, // orange
};

/**
 * Portal-aware map composite with pixel-perfect building click areas.
 *
 * Layout:
 *   - Outer SVG with viewBox="0 0 100 100" so all coordinates are in
 *     percentages of the square map.
 *   - Layer 1: empty island background (`/maps/{portal}-island-bg.png`
 *     for KET, future `/maps/pet-city-bg.png` for PET).
 *   - Layer 2: 6 transparent-background building <image> elements,
 *     each positioned via the chip's `placement` box. Click registers
 *     only on opaque pixels via `pointer-events="visiblePainted"`.
 *   - Layer 3: chip name-tag <Link>s overlaid as DOM elements (so
 *     typography matches the rest of the app) anchored to a corner
 *     of each placement box.
 *
 * Why client component: SVG <image onClick> requires JS — we route via
 * useRouter() to keep Next.js client-side navigation. The chip name-tag
 * <Link>s remain pure DOM links so keyboard tab order picks them up.
 */
export function PortalMap({
  portal,
  chips,
  alt,
  debug = false,
}: PortalMapProps) {
  const router = useRouter();
  const bgSrc =
    portal === "ket" ? "/maps/ket-island-bg.png" : "/maps/pet-city.png"; // PET pixel-perfect bg lands in Phase C
  const defaultAlt = portal === "ket" ? "KET 岛" : "PET 城";

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

        {/* Layer 1: empty island background */}
        <image
          href={bgSrc}
          x="0"
          y="0"
          width="100"
          height="100"
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Layer 2: per-building click images.
            visiblePainted = pointer events fire only on opaque pixels →
            pixel-perfect click areas. Cursor pointer + accessible role. */}
        {chips.map((c) => (
          <image
            key={c.mode}
            href={c.imgSrc}
            x={c.placement.x}
            y={c.placement.y}
            width={c.placement.w}
            height={c.placement.h}
            preserveAspectRatio="xMidYMid meet"
            style={{ pointerEvents: "visiblePainted", cursor: "pointer" }}
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

      {/* Layer 3: DOM chip name-tag overlays. Decorative + redundant
          click target. Keyboard nav already covered by SVG <image>
          tabIndex; these are aria-hidden. */}
      {chips.map((c) => {
        const anchor = c.labelAnchor ?? "top-left";
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
              className={`pointer-events-auto absolute inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-[2.5px] px-2 py-1 text-[0.7rem] font-extrabold shadow-md motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 ${
                c.active
                  ? "bg-ink text-white border-ink"
                  : "bg-white/95 border-ink text-ink"
              } ${ANCHOR_POSITION[anchor]}`}
            >
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
