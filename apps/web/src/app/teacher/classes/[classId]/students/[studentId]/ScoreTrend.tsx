"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TrendAttempt = {
  id: string;
  examType: "KET" | "PET";
  kind: string;
  part: number | null;
  scaledScore: number;
  startedAt: string;
};

type Props = {
  attempts: TrendAttempt[];
  classId: string;
  studentId: string;
};

const KIND_ZH: Record<string, string> = {
  READING: "阅读",
  WRITING: "写作",
  LISTENING: "听力",
  SPEAKING: "口语",
  MOCK_FULL: "全套模拟",
  MOCK_SECTION: "单项模拟",
};

const Y_GRID = [100, 70, 50, 25, 0] as const;

function scoreBarColor(pct: number): string {
  if (pct >= 70) return "bg-green-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(pct: number): string {
  if (pct >= 70) return "text-green-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScoreTrend({ attempts, classId, studentId }: Props) {
  const buckets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of attempts) {
      const key = `${a.examType}-${a.kind}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  }, [attempts]);

  const [filter, setFilter] = useState<string>(() => buckets[0]?.key ?? "");
  const [view, setView] = useState<"chart" | "table">("chart");

  const filteredChrono = useMemo(() => {
    if (!filter) return [];
    const subset = attempts.filter(
      (a) => `${a.examType}-${a.kind}` === filter,
    );
    return subset.slice(0, 10).reverse(); // oldest → newest
  }, [attempts, filter]);

  const filteredDesc = useMemo(() => {
    if (!filter) return [];
    return attempts.filter((a) => `${a.examType}-${a.kind}` === filter);
  }, [attempts, filter]);

  const stats = useMemo(() => {
    if (filteredChrono.length === 0) return null;
    const scores = filteredChrono.map((a) => a.scaledScore);
    const avg = Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
    const best = Math.max(...scores);
    const worst = Math.min(...scores);
    const first = scores[0];
    const last = scores[scores.length - 1];
    const delta = last - first;
    return { avg, best, worst, delta };
  }, [filteredChrono]);

  const currentLabel = useMemo(() => {
    if (!filter) return "";
    const [examType, kind] = filter.split("-");
    return `${examType} ${KIND_ZH[kind] ?? kind}`;
  }, [filter]);

  if (buckets.length === 0) return null;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {buckets.map((b) => {
            const [examType, kind] = b.key.split("-");
            const label = `${examType} ${KIND_ZH[kind] ?? kind}`;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setFilter(b.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  filter === b.key
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-900"
                }`}
              >
                {label} ({b.count})
              </button>
            );
          })}
        </div>
        <div className="flex overflow-hidden rounded-md border border-neutral-300">
          <button
            type="button"
            onClick={() => setView("chart")}
            className={`px-3 py-1 text-xs font-medium transition ${
              view === "chart"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            图表
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`border-l border-neutral-300 px-3 py-1 text-xs font-medium transition ${
              view === "table"
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            表格
          </button>
        </div>
      </div>

      <div className="rounded-md border border-neutral-200 p-4">
        {filteredChrono.length === 0 ? (
          <div className="py-8 text-center text-sm text-neutral-500">
            当前筛选下暂无已批改答卷
          </div>
        ) : (
          <>
            {/* Summary line (shared between views) */}
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
              <span>
                <span className="text-neutral-400">科目：</span>
                <span className="font-medium text-neutral-800">
                  {currentLabel}
                </span>
              </span>
              <span>
                <span className="text-neutral-400">次数：</span>
                <span className="font-medium text-neutral-800">
                  {filteredChrono.length}
                </span>
              </span>
              {stats && (
                <>
                  <span>
                    <span className="text-neutral-400">平均：</span>
                    <span className={`font-medium ${scoreTextColor(stats.avg)}`}>
                      {stats.avg}%
                    </span>
                  </span>
                  <span>
                    <span className="text-neutral-400">最高：</span>
                    <span
                      className={`font-medium ${scoreTextColor(stats.best)}`}
                    >
                      {stats.best}%
                    </span>
                  </span>
                  <span>
                    <span className="text-neutral-400">最低：</span>
                    <span
                      className={`font-medium ${scoreTextColor(stats.worst)}`}
                    >
                      {stats.worst}%
                    </span>
                  </span>
                  {filteredChrono.length > 1 && (
                    <span>
                      <span className="text-neutral-400">变化：</span>
                      <span
                        className={`font-medium ${
                          stats.delta > 0
                            ? "text-green-700"
                            : stats.delta < 0
                              ? "text-red-700"
                              : "text-neutral-700"
                        }`}
                      >
                        {stats.delta > 0 ? "+" : ""}
                        {stats.delta}%
                      </span>
                    </span>
                  )}
                </>
              )}
            </div>

            {view === "chart" ? (
              <div className="flex gap-3">
                {/* Y-axis labels */}
                <div className="relative w-8 shrink-0" style={{ height: 220 }}>
                  {Y_GRID.map((v) => (
                    <div
                      key={v}
                      className="absolute right-0 -translate-y-1/2 text-[10px] text-neutral-400"
                      style={{ top: `${100 - v}%` }}
                    >
                      {v}
                    </div>
                  ))}
                </div>
                {/* Plot area */}
                <div className="relative flex-1">
                  {/* Gridlines */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ height: 220 }}
                  >
                    {Y_GRID.map((v) => (
                      <div
                        key={v}
                        className={`absolute left-0 right-0 border-t ${
                          v === 70
                            ? "border-green-200"
                            : v === 0
                              ? "border-neutral-300"
                              : "border-dashed border-neutral-200"
                        }`}
                        style={{ top: `${100 - v}%` }}
                      >
                        {v === 70 && (
                          <span className="absolute right-0 -translate-y-full rounded-sm bg-green-50 px-1 text-[10px] font-medium text-green-700">
                            合格线 70%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Bars */}
                  <div
                    className="relative flex items-end gap-2"
                    style={{ height: 220 }}
                  >
                    {filteredChrono.map((a) => {
                      const pct = a.scaledScore;
                      // 2% floor just so a 0 still has a visible sliver
                      const heightPct = Math.max(pct, 2);
                      const kindZh = KIND_ZH[a.kind] ?? a.kind;
                      const tooltip = `${a.examType} ${kindZh}${a.part ? " Part " + a.part : ""} · ${pct}% · ${formatDateFull(a.startedAt)}`;
                      return (
                        <Link
                          key={a.id}
                          href={`/teacher/classes/${classId}/students/${studentId}/attempts/${a.id}`}
                          className="group flex flex-1 flex-col items-center justify-end"
                          title={tooltip}
                          style={{ height: "100%" }}
                        >
                          <div
                            className={`mb-0.5 text-[10px] font-semibold ${scoreTextColor(pct)}`}
                          >
                            {pct}
                          </div>
                          <div
                            className={`w-full rounded-t ${scoreBarColor(pct)} transition-opacity group-hover:opacity-80`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </Link>
                      );
                    })}
                  </div>
                  {/* X-axis date labels */}
                  <div className="mt-2 flex gap-2">
                    {filteredChrono.map((a) => (
                      <div
                        key={a.id}
                        className="flex-1 text-center text-[10px] text-neutral-500"
                      >
                        {formatDateShort(a.startedAt)}
                        {a.part != null && (
                          <div className="text-[10px] text-neutral-400">
                            P{a.part}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                      <th className="py-2 pr-3">日期</th>
                      <th className="py-2 pr-3">题型</th>
                      <th className="py-2 pr-3">得分</th>
                      <th className="py-2 pr-3 w-[40%]">可视化</th>
                      <th className="py-2 pr-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDesc.map((a) => {
                      const pct = a.scaledScore;
                      const kindZh = KIND_ZH[a.kind] ?? a.kind;
                      return (
                        <tr
                          key={a.id}
                          className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                        >
                          <td className="py-2 pr-3 text-xs text-neutral-600">
                            {formatDateFull(a.startedAt)}
                          </td>
                          <td className="py-2 pr-3">
                            {a.examType} {kindZh}
                            {a.part != null && ` Part ${a.part}`}
                          </td>
                          <td
                            className={`py-2 pr-3 font-mono font-semibold ${scoreTextColor(pct)}`}
                          >
                            {pct}%
                          </td>
                          <td className="py-2 pr-3">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                              <div
                                className={`h-full ${scoreBarColor(pct)}`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right">
                            <Link
                              href={`/teacher/classes/${classId}/students/${studentId}/attempts/${a.id}`}
                              className="text-xs text-neutral-600 hover:text-neutral-900"
                            >
                              查看 →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {view === "chart" && (
              <div className="mt-3 text-center text-[11px] text-neutral-500">
                悬停查看详情 · 点击柱形打开完整答卷
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
