"use client";

import Link from "next/link";
import type { Portal } from "@/i18n/voice";

export interface ModeChip {
  mode: "reading" | "listening" | "writing" | "speaking" | "vocab" | "grammar";
  /** Visible chip label (e.g., "📖 读" for KET kid voice or "阅读" for PET teen voice). */
  label: string;
  /** Click-through target. */
  href: string;
  /**
   * Where the chip name-tag sits on the map, in viewBox coords (the SVG
   * uses viewBox="0 0 100 100" so values are percentages). The name-tag
   * renders ABOVE the building it labels.
   */
  tagPosition: { x: number; y: number };
  /** Renders the chip name-tag in the highlighted ink-black variant. */
  active?: boolean;
  /**
   * Ordinal in the learning path (1-based). Renders as a small numbered
   * badge inside the chip name-tag.
   */
  order?: number;
  /**
   * Right-aligned secondary metric (e.g., "84%" accuracy).
   * Optional — omit when no real value is computed for the user.
   */
  accuracy?: string;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  /** Optional override for the map alt text. */
  alt?: string;
}

/**
 * Portal-aware map composite using a vectorized unified illustration.
 *
 * For KET: /maps/ket-island.svg — produced by vectorize-ket-island.mts,
 * which bins imagetracerjs paths by per-building bounding box into named
 * <g id="reading">, <g id="writing">, etc. groups. Each group is wrapped
 * in <a href="/ket/<mode>/new"> inside the SVG, so clicking any painted
 * pixel of a building navigates via standard HTML.
 *
 * The chip name-tags overlay on top as DOM <Link>s for typography +
 * ordinal badges (① ② ③ ④ ⑤ ⑥). They're aria-hidden because the SVG <a>s
 * already provide the accessible link per building.
 *
 * Trade-off: SVG <a> fires a full page navigation (no Next.js client
 * routing). For portal-home → mode-page transitions this is acceptable
 * — the destination renders fresh anyway.
 */
export function PortalMap({ portal, chips, alt }: PortalMapProps) {
  const svgSrc =
    portal === "ket"
      ? "/maps/ket-island.svg"
      : "/maps/pet-city.png"; // PET vectorization lands in Phase C
  const defaultAlt = portal === "ket" ? "KET 岛" : "PET 城";
  const isVector = portal === "ket";

  return (
    <div
      className="stitched-card relative w-full aspect-square overflow-hidden rounded-2xl"
      role="img"
      aria-label={alt ?? defaultAlt}
    >
      {isVector ? (
        // Inline-fetch the SVG so its internal <a href> elements navigate
        // on click. <object> sandboxes the SVG's links to the same
        // origin; clicking any painted pixel of a building <g> navigates.
        <object
          data={svgSrc}
          type="image/svg+xml"
          aria-label={alt ?? defaultAlt}
          className="absolute inset-0 h-full w-full"
        >
          <img
            src={svgSrc}
            alt={alt ?? defaultAlt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </object>
      ) : (
        // Fallback (PET portal until Phase C vectorizes its map).
        <img
          src={svgSrc}
          alt={alt ?? defaultAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Chip name-tags overlay — order badge + label, anchored to a
          point above each building. The <object> below already handles
          clicks on the building artwork; these chips are aria-hidden so
          screen-reader nav doesn't double up, but sighted users get a
          redundant click target via Next/Link (so name-tag clicks stay
          on Next's client router). */}
      {chips.map((c) => (
        <div
          key={c.mode}
          className="pointer-events-none absolute"
          style={{
            left: `${c.tagPosition.x}%`,
            top: `${c.tagPosition.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <Link
            href={c.href}
            aria-hidden="true"
            tabIndex={-1}
            className={`pointer-events-auto inline-flex cursor-pointer items-center gap-1 rounded-xl border-2 px-2 py-1 text-[0.7rem] font-extrabold shadow-sm motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 ${
              c.active
                ? "bg-ink text-white border-ink/70"
                : "bg-white/95 border-ink/30 text-ink"
            }`}
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
      ))}
    </div>
  );
}
