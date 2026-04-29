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
  /** Absolute CSS positioning over the map background, expressed as percentages. */
  position: { top: string; left: string };
  /** Renders the chip in the highlighted ink-black variant (today's recommendation). */
  active?: boolean;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  /** Optional override for the map image alt text. */
  alt?: string;
}

/**
 * Portal-aware map background with mode-chip overlay. KET portals show
 * KET 岛 (island), PET portals show PET 城 (city). Chips are absolutely
 * positioned over the buildings; clicking a chip routes into that mode.
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
            className={`pointer-events-auto absolute inline-flex items-center gap-1.5 rounded-xl border-[2.5px] px-2 py-1 text-[0.7rem] font-extrabold shadow-md transition hover:translate-y-[-2px] ${
              c.active
                ? "bg-ink text-white border-ink"
                : "bg-white/95 border-ink text-ink"
            }`}
            style={{ top: c.position.top, left: c.position.left }}
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
        ))}
      </div>
    </div>
  );
}
