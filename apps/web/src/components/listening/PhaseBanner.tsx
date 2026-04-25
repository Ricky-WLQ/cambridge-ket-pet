"use client";

export function PhaseBanner({ phase }: { phase: "LISTENING" | "REVIEW" }) {
  if (phase !== "REVIEW") return null;
  return (
    <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-4 rounded">
      <p className="font-semibold text-amber-900">
        听力播放完成。可修改答案，时间到后将自动提交。
      </p>
    </div>
  );
}
