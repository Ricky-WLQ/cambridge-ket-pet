import Image from "next/image";
import type { Portal } from "@/i18n/voice";

export type MascotPose =
  | "greeting"
  | "waving"
  | "reading"
  | "listening"
  | "writing"
  | "microphone"
  | "flashcards"
  | "chart"
  | "celebrating"
  | "thinking"
  | "sleeping"
  | "confused";

interface MascotProps {
  pose: MascotPose;
  portal: Portal;
  width?: number;
  height?: number;
  className?: string;
  /** Override alt text. Defaults to "Leo" for ket and "Aria" for pet. */
  alt?: string;
  /** When true, the image is purely decorative (alt=""). */
  decorative?: boolean;
}

/**
 * Per-portal mascot image. Resolves to /mascots/leo/<pose>.png for KET and
 * /mascots/aria/<pose>.png for PET. Assets live under apps/web/public/ and
 * are served by Next.js with immutable cache headers.
 */
export function Mascot({
  pose,
  portal,
  width = 96,
  height = 96,
  className,
  alt,
  decorative = false,
}: MascotProps) {
  const character = portal === "ket" ? "leo" : "aria";
  const defaultAlt = portal === "ket" ? "Leo" : "Aria";
  // Cache-buster so the browser + next/image optimizer refetch when
  // pose assets are regenerated (otherwise old optimized versions stick
  // around even after a hard refresh). Bump this when assets change.
  const ASSET_VERSION = 4;
  const src = `/mascots/${character}/${pose}.png?v=${ASSET_VERSION}`;
  return (
    <Image
      src={src}
      alt={decorative ? "" : (alt ?? defaultAlt)}
      width={width}
      height={height}
      className={className}
      priority={pose === "greeting"}
    />
  );
}
