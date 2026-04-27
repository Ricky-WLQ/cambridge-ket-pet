"use client";

interface Props {
  totalParts: number;
  currentPart: number;
}

export function PartProgressBar({ totalParts, currentPart }: Props) {
  return (
    <div className="flex w-full max-w-[480px] items-center gap-3 text-sm font-bold text-ink">
      <span className="whitespace-nowrap">
        第 {currentPart} 部分 / 共 {totalParts} 部分
      </span>
      <div className="flex flex-1 gap-1" aria-hidden>
        {Array.from({ length: totalParts }, (_, i) => {
          const n = i + 1;
          const isCurrent = n === currentPart;
          const isComplete = n < currentPart;
          return (
            <span
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                isCurrent ? "bg-ink" : isComplete ? "bg-ink/40" : "bg-ink/15"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
