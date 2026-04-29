import Image from "next/image";
import Link from "next/link";
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
   * Bounding box of the building footprint on the map, expressed as CSS
   * percentages. The clipPath polygon below cuts the click area to the
   * building's actual silhouette within this box.
   */
  region: { top: string; left: string; width: string; height: string };
  /**
   * CSS clip-path polygon string (relative to the region's own box) that
   * matches the building silhouette. Click and hover only register inside
   * the polygon — so the *house itself* is the click target, not the
   * surrounding rectangle.
   *
   * Example house pentagon: `polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%)`
   */
  clipPath: string;
  /** Where the chip name-tag sits inside the region (defaults to top-left). */
  labelAnchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Renders the chip name-tag in the highlighted ink-black variant. */
  active?: boolean;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  /** Optional override for the map image alt text. */
  alt?: string;
}

const ANCHOR_POSITION: Record<NonNullable<ModeChip["labelAnchor"]>, string> = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

/**
 * Portal-aware map background with clickable building silhouettes.
 *
 * Each chip renders TWO sibling links inside an unclipped wrapper:
 *   1. A large building-shaped link (`clip-path: polygon(...)`) — primary
 *      click target; matches the visible building outline.
 *   2. A small decorative name-tag link in a corner of the wrapper —
 *      redundant click target for kids who tap the label, marked
 *      aria-hidden + tabIndex=-1 so keyboard/screen-reader nav sees only
 *      the primary link.
 *
 * Hover state on the building link: claymorphism soft press — subtle
 * ink wash inside the clipped polygon, 200ms ease-out, motion-safe so
 * `prefers-reduced-motion` users don't see the scale animation. Per
 * ui-ux-pro-max (Immersive/Interactive pattern + Claymorphism style).
 */
export function PortalMap({ portal, chips, alt }: PortalMapProps) {
  const src = portal === "ket" ? "/maps/ket-island.png" : "/maps/pet-city.png";
  const defaultAlt = portal === "ket" ? "KET 岛" : "PET 城";
  return (
    <div className="stitched-card relative w-full aspect-square overflow-hidden rounded-2xl">
      <Image
        src={src}
        alt={alt ?? defaultAlt}
        fill
        sizes="(max-width: 768px) 100vw, 600px"
        priority
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0">
        {chips.map((c) => (
          <div
            key={c.mode}
            className="pointer-events-none absolute"
            style={{
              top: c.region.top,
              left: c.region.left,
              width: c.region.width,
              height: c.region.height,
            }}
          >
            {/* (1) Primary click target — building silhouette via clip-path. */}
            <Link
              href={c.href}
              aria-label={c.label}
              style={{ clipPath: c.clipPath }}
              className="pointer-events-auto absolute inset-0 block cursor-pointer bg-ink/0 motion-safe:transition-colors motion-safe:duration-200 hover:bg-ink/15 focus-visible:bg-ink/20 focus-visible:outline-none"
            />

            {/* (2) Decorative chip name-tag — small redundant click target. */}
            <Link
              href={c.href}
              aria-hidden="true"
              tabIndex={-1}
              className={`pointer-events-auto absolute inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-[2.5px] px-2 py-1 text-[0.7rem] font-extrabold shadow-md motion-safe:transition-transform motion-safe:duration-200 hover:scale-105 ${
                c.active
                  ? "bg-ink text-white border-ink"
                  : "bg-white/95 border-ink text-ink"
              } ${ANCHOR_POSITION[c.labelAnchor ?? "top-left"]}`}
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
        ))}
      </div>
    </div>
  );
}
