import Link from "next/link";
import { Mascot, type MascotPose } from "./Mascot";
import type { Portal } from "@/i18n/voice";

interface TodayCardProps {
  portal: Portal;
  /** Small uppercase label above the title (e.g., "今天" for KET, "TODAY" for PET). */
  label: string;
  /** Main headline (e.g., "来 5 道听力题"). */
  title: string;
  /** One-line hint below the title (e.g., "Leo 给你挑了 Part 1 · 8 分钟"). */
  hint: string;
  /** CTA href. */
  href: string;
  /** CTA button label (e.g., "开始 →"). */
  ctaLabel: string;
  /** Mascot pose. Defaults to "greeting"; override per recommended-task context. */
  mascotPose?: MascotPose;
}

/**
 * Today's recommended action card on the portal home. Highlights ONE thing
 * the student should do today, demoting the other modes to map chips.
 */
export function TodayCard({
  portal,
  label,
  title,
  hint,
  href,
  ctaLabel,
  mascotPose = "greeting",
}: TodayCardProps) {
  const isKet = portal === "ket";
  const bg = isKet
    ? "linear-gradient(135deg, #ffe066, #ffc4d1)"
    : "linear-gradient(135deg, #c7b8ff, #7db8ff)";
  const textColor = isKet ? "text-ink" : "text-[#1f1837]";
  const ctaBg = isKet ? "bg-ink" : "bg-[#1f1837]";
  return (
    <div
      className={`stitched-card relative overflow-hidden rounded-2xl px-4 py-3.5 ${textColor}`}
      style={{ background: bg }}
    >
      <div className="pointer-events-none absolute right-[-8px] bottom-[-8px] opacity-90">
        <Mascot
          pose={mascotPose}
          portal={portal}
          width={80}
          height={80}
          decorative
        />
      </div>
      <div className="relative max-w-[70%]">
        <div className="text-[0.6rem] font-extrabold tracking-[0.06em] opacity-65">
          {label}
        </div>
        <h3 className="mt-1 text-base font-extrabold leading-tight">{title}</h3>
        <p className="mt-1 text-[0.7rem] font-medium opacity-65">{hint}</p>
        <Link
          href={href}
          className={`mt-2.5 inline-block rounded-full ${ctaBg} px-3.5 py-1.5 text-xs font-extrabold text-white hover:opacity-90 transition`}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
