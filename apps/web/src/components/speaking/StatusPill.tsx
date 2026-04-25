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
  connecting: "bg-neutral-400 animate-pulse",
  listening: "bg-emerald-500",
  thinking: "bg-amber-500 animate-pulse",
  speaking: "bg-blue-500",
  ended: "bg-neutral-500",
};

export function StatusPill({ status }: { status: SpeakingStatusLabel }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-sm text-neutral-100">
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} aria-hidden />
      <span>{COPY[status]}</span>
    </div>
  );
}
