import type { WordTier } from "@prisma/client";

const LABELS: Record<WordTier, string> = {
  CORE: "必修",
  RECOMMENDED: "推荐",
  EXTRA: "拓展",
};

const STYLES: Record<WordTier, string> = {
  CORE: "border-yellow-600 bg-yellow-50 text-yellow-800",
  RECOMMENDED: "border-neutral-300 bg-white text-neutral-700",
  EXTRA: "border-neutral-300 bg-white text-neutral-500",
};

export function TierBadge({ tier, className = "" }: { tier: WordTier; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[tier]} ${className}`}
    >
      {LABELS[tier]}
    </span>
  );
}
