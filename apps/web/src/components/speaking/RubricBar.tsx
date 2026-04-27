"use client";

interface Props {
  label: string;
  score: number;
  max?: number;
}

export function RubricBar({ label, score, max = 5 }: Props) {
  const clamped = Math.max(0, Math.min(max, score));
  const pct = (clamped / max) * 100;
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink/80 font-bold">{label}</span>
        <span className="tabular-nums text-sm text-ink/60 font-bold">
          {clamped} / {max}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={clamped}
        />
      </div>
    </div>
  );
}
