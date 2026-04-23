"use client";

export function GenerationProgress({ elapsedSec }: { elapsedSec: number }) {
  return (
    <div className="p-6 text-center">
      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
      <p className="font-semibold">
        正在生成听力测试 — 通常需要 1-2 分钟
      </p>
      <p className="text-sm text-slate-500 mt-2">已用时 {elapsedSec} 秒</p>
    </div>
  );
}
