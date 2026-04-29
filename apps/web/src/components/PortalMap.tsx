import Link from "next/link";
import { Mascot, type MascotPose } from "./Mascot";
import type { Portal } from "@/i18n/voice";

export interface ModeChip {
  mode: "reading" | "listening" | "writing" | "speaking" | "vocab" | "grammar";
  /** Visible chip label (e.g., "📖 读" for KET kid voice or "阅读" for PET teen voice). */
  label: string;
  /** Click-through target (real route). */
  href: string;
  /**
   * Ordinal in the learning path (1-based) — renders as a small numbered
   * badge in the corner of the tile. Order: ① 词 → ⑥ 写.
   */
  order: number;
  /**
   * Mascot pose to render inside the tile (e.g., 'flashcards' for vocab,
   * 'reading' for reading mode). Picks from the 12-pose library.
   */
  mascotPose: MascotPose;
  /**
   * Tile palette key — selects the per-tile pastel background. Maps to
   * the existing Variant A tile classes in globals.css.
   */
  palette: "lavender" | "sky" | "butter" | "peach" | "mint" | "cream";
  /** Optional Cambridge English subtitle below the label (e.g., "Reading"). */
  subtitle?: string;
}

interface PortalMapProps {
  portal: Portal;
  chips: ModeChip[];
  /** Optional grid title shown above the tiles. */
  title?: string;
}

const TILE_BG: Record<ModeChip["palette"], string> = {
  lavender: "tile-lavender",
  sky: "tile-sky",
  butter: "tile-butter",
  peach: "tile-peach",
  mint: "tile-mint",
  cream: "tile-cream",
};

/**
 * Per-portal "learning journey" tile grid.
 *
 * Replaces the earlier illustrated-map approach which couldn't reach
 * production quality with the available raster-AI toolchain (separate
 * generations drift in style; vectorized output blurs to oil-painting;
 * SVG <a> in <object> sandboxes navigation). The tile grid:
 *
 *  - Renders 6 large tiles in a 3×2 grid (2×3 on mobile)
 *  - Each tile shows ordinal ① ② ③ ④ ⑤ ⑥ + Mascot pose + label + arrow
 *  - Click-through is via next/link → client-side routing intact
 *  - Pixel-perfect by definition (each tile is a rectangle)
 *  - Production-ready immediately; commissioning a proper illustrated
 *    map is a Phase-5 follow-up that can swap this component without
 *    affecting downstream phases
 */
export function PortalMap({ portal, chips, title }: PortalMapProps) {
  return (
    <div className="flex grow-fill w-full flex-col gap-2.5">
      {title && (
        <h2 className="px-1 text-xs font-extrabold tracking-[0.06em] text-ink/55">
          {title}
        </h2>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 grow-fill">
        {chips.map((c) => (
          <Link
            key={c.mode}
            href={c.href}
            className={`skill-tile stitched-card group ${TILE_BG[c.palette]} relative cursor-pointer`}
          >
            <div className="flex items-start justify-between">
              {/* Ordinal badge */}
              <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-extrabold text-white shadow-sm">
                {c.order}
              </span>
              <span className="arrow-chip">→</span>
            </div>

            <div className="flex flex-col items-start gap-2">
              <Mascot
                pose={c.mascotPose}
                portal={portal}
                width={88}
                height={88}
                decorative
                className="drop-shadow-sm"
              />
              <div>
                <div className="text-3xl font-extrabold leading-tight sm:text-4xl">
                  {c.label}
                </div>
                {c.subtitle && (
                  <div className="mt-1 text-sm font-bold text-ink/55">
                    {c.subtitle}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
