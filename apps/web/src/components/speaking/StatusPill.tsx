"use client";

export type SpeakingStatusLabel = "connecting" | "listening" | "thinking" | "speaking" | "ended";

const COPY: Record<SpeakingStatusLabel, string> = {
  connecting: "正在连接…",
  listening: "请开始讲话",
  thinking: "Mina 正在思考…",
  speaking: "Mina 正在讲话",
  ended: "已结束",
};

const DOT: Record<SpeakingStatusLabel, string> = {
  connecting: "bg-ink/40 animate-pulse",
  listening: "bg-emerald-500",
  thinking: "bg-amber-500 animate-pulse",
  speaking: "bg-blue-500",
  ended: "bg-ink/40",
};

// State→tile color mapping per spec: mint=ready/listening, butter=processing/thinking,
// peach=error/ended, sky=in-progress/speaking. Connecting uses neutral white.
const TONE: Record<SpeakingStatusLabel, string> = {
  connecting: "bg-white border-ink/15",
  listening: "bg-mint-tint border-ink/15",
  thinking: "bg-butter-tint border-ink/15",
  speaking: "bg-sky-tint border-ink/15",
  ended: "bg-peach-tint border-ink/15",
};

export function StatusPill({ status }: { status: SpeakingStatusLabel }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-bold text-ink ${TONE[status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
      <span>{COPY[status]}</span>
    </div>
  );
}
