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
   * percentages. The entire region is the click target — direct
   * manipulation of the building artwork (per ui-ux-pro-max
   * Immersive/Interactive pattern). Tap targets ≥ 44x44 px on mobile
   * comfortably exceeded by these building-sized regions.
   */
  region: { top: string; left: string; width: string; height: string };
  /** Optional: where the chip *label* sits inside the region (defaults to top-left). */
  labelAnchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Renders the chip label in the highlighted ink-black variant (today's recommendation). */
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
 * Portal-aware map background with mode-chip overlay. KET portals show
 * KET 岛 (island), PET portals show PET 城 (city). Each building has an
 * invisible click region covering its footprint; the chip is a small
 * name-tag label inside the region (top-left by default).
 *
 * Hover state: claymorphism soft-press — subtle scale + ink ring at
 * 200ms ease-out. Respects prefers-reduced-motion via Tailwind's
 * motion-safe: prefix.
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
          <Link
            key={c.mode}
            href={c.href}
            aria-label={c.label}
            className="pointer-events-auto group absolute block rounded-2xl ring-0 ring-ink/0 motion-safe:transition-all motion-safe:duration-200 hover:ring-4 hover:ring-ink/30 focus-visible:ring-4 focus-visible:ring-ink/60 focus-visible:outline-none motion-safe:hover:scale-[1.02] cursor-pointer"
            style={{
              top: c.region.top,
              left: c.region.left,
              width: c.region.width,
              height: c.region.height,
            }}
          >
            {/* Soft press effect: a transparent inner layer that gains a
                subtle dark wash on hover/focus to confirm the building was
                tapped. */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-ink/0 motion-safe:transition-colors motion-safe:duration-200 group-hover:bg-ink/5 group-focus-visible:bg-ink/10"
            />

            {/* Chip name-tag — small label anchored to a corner of the
                building region. Decorative; the click target is the whole
                region above. */}
            <span
              className={`pointer-events-none absolute inline-flex items-center gap-1.5 rounded-xl border-[2.5px] px-2 py-1 text-[0.7rem] font-extrabold shadow-md ${
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
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
