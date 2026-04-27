"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ExamType, WordTier } from "@prisma/client";
import type { WordDto, VocabProgressDto, VocabStats, WordlistTotals, PaginationDto } from "@/lib/vocab/types";
import { WordRow } from "./WordRow";

const TIER_LABELS: Record<WordTier, { zh: string; stars: string; sub: string }> = {
  CORE:        { zh: "必修核心", stars: "★★★", sub: "必须掌握 · 决定通过率" },
  RECOMMENDED: { zh: "推荐",     stars: "★★",  sub: "建议掌握 · 高分必备" },
  EXTRA:       { zh: "拓展",     stars: "★",   sub: "非必须 · 进阶提升" },
};

interface Props { examType: ExamType }

interface WordsResponse { words: WordDto[]; totalCount: number; pagination: PaginationDto }
interface ProgressResponse {
  progress: VocabProgressDto[];
  stats: VocabStats;
  wordlistTotals: WordlistTotals;
}

export default function VocabHub({ examType }: Props) {
  const examLabel = examType === "KET" ? "A2 Key" : "B1 Preliminary";
  const examLabelZh = examType === "KET" ? "KET" : "PET";

  const [stats, setStats] = useState<VocabStats | null>(null);
  const [wordlistTotals, setWordlistTotals] = useState<WordlistTotals | null>(null);
  const [progressByWord, setProgressByWord] = useState<Map<string, VocabProgressDto>>(new Map());
  const [words, setWords] = useState<WordDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<WordTier | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch progress + stats once.
  useEffect(() => {
    let aborted = false;
    fetch(`/api/vocab/progress?examType=${examType}`)
      .then((r) => r.json() as Promise<ProgressResponse>)
      .then((data) => {
        if (aborted) return;
        setStats(data.stats);
        setProgressByWord(new Map(data.progress.map((p) => [p.wordId, p])));
        setWordlistTotals(data.wordlistTotals);
      })
      .catch((err) => console.error("[vocab] progress fetch failed:", err));
    return () => { aborted = true; };
  }, [examType]);

  // Fetch words list when filters change.
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    const qs = new URLSearchParams({ examType, page: String(page), pageSize: "50" });
    if (tierFilter !== "ALL") qs.set("tier", tierFilter);
    if (search.trim()) qs.set("search", search.trim());
    fetch(`/api/vocab/words?${qs}`)
      .then((r) => r.json() as Promise<WordsResponse>)
      .then((data) => {
        if (aborted) return;
        setWords(data.words);
        setTotalCount(data.totalCount);
        setLoading(false);
      })
      .catch((err) => { if (!aborted) { console.error("[vocab] words fetch failed:", err); setLoading(false); } });
    return () => { aborted = true; };
  }, [examType, page, tierFilter, search]);

  const overallPct = useMemo(() => {
    const mastered = stats?.byTier.CORE.mastered ?? 0;
    const total = wordlistTotals?.byTier.CORE ?? 0;
    return total === 0 ? 0 : Math.round((mastered / total) * 100);
  }, [stats, wordlistTotals]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8 flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-extrabold leading-tight">
          {examLabelZh} 词汇 · <span className="marker-yellow-thick">{examLabel} Vocabulary</span>
        </h1>
        <p className="mt-2 text-sm font-medium text-ink/65">
          Cambridge {examLabel} 官方词表（2025 修订）{wordlistTotals ? ` · 共 ${wordlistTotals.total} 词` : ""}
        </p>
      </header>

      {/* Overall mastery card */}
      <div className="rounded-2xl tile-butter border-2 border-ink/10 p-5 stitched-card">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs font-bold text-ink/65">总体掌握度（必修核心词）</div>
            <div className="mt-1 text-3xl font-extrabold">
              {stats?.byTier.CORE.mastered ?? "—"}{" "}
              <span className="text-base font-bold text-ink/40">
                / {wordlistTotals?.byTier.CORE ?? "—"}
              </span>
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700">{overallPct}%</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full bg-amber-600" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* Practice CTAs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/${examType.toLowerCase()}/vocab/listen?tier=CORE`}
          className="rounded-2xl border-2 border-ink/10 tile-sky p-4 stitched-card transition hover:-translate-y-0.5 hover:border-ink"
        >
          <div className="text-sm font-extrabold text-ink">🔊 听写 · 必修</div>
          <div className="mt-1 text-xs font-bold text-ink/65">{wordlistTotals?.byTier.CORE ?? "—"} 个核心词</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/spell?tier=CORE`}
          className="rounded-2xl border-2 border-ink/10 tile-butter p-4 stitched-card transition hover:-translate-y-0.5 hover:border-ink"
        >
          <div className="text-sm font-extrabold text-ink">✏️ 拼写 · 必修</div>
          <div className="mt-1 text-xs font-bold text-ink/65">填字母练习</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/listen`}
          className="rounded-2xl border-2 border-ink/10 tile-mint p-4 stitched-card transition hover:-translate-y-0.5 hover:border-ink"
        >
          <div className="text-sm font-extrabold text-ink">🔊 听写 · 混合</div>
          <div className="mt-1 text-xs font-bold text-ink/65">所有词混合</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/spell`}
          className="rounded-2xl border-2 border-ink/10 tile-peach p-4 stitched-card transition hover:-translate-y-0.5 hover:border-ink"
        >
          <div className="text-sm font-extrabold text-ink">✏️ 拼写 · 混合</div>
          <div className="mt-1 text-xs font-bold text-ink/65">所有词混合</div>
        </Link>
      </div>

      {/* Tier cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["CORE", "RECOMMENDED", "EXTRA"] as WordTier[]).map((t) => {
          const meta = TIER_LABELS[t];
          const mastered = stats?.byTier[t]?.mastered ?? 0;
          const total = wordlistTotals?.byTier[t] ?? 0;
          const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
          const tileClass = t === "CORE" ? "tile-butter" : t === "RECOMMENDED" ? "tile-lavender" : "tile-sky";
          return (
            <Link
              key={t}
              href={`/${examType.toLowerCase()}/vocab/listen?tier=${t}`}
              className={`stat-card ${tileClass} stitched-card p-4 transition hover:-translate-y-0.5 hover:border-ink`}
            >
              <div className="text-xs font-extrabold uppercase tracking-wide text-ink/70">
                {meta.zh} {meta.stars}
              </div>
              <div className="mt-1 text-lg font-extrabold text-ink">
                {mastered} / {total}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className={`h-full ${pct >= 80 ? "bg-emerald-600" : pct >= 50 ? "bg-amber-600" : "bg-red-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-bold text-ink/65">{meta.sub}</div>
            </Link>
          );
        })}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-ink/10 bg-white p-3 stitched-card">
        {(["ALL", "CORE", "RECOMMENDED", "EXTRA"] as const).map((t) => {
          const counts = wordlistTotals
            ? t === "ALL"
              ? wordlistTotals.total
              : wordlistTotals.byTier[t as WordTier]
            : "";
          return (
            <button
              key={t}
              onClick={() => { setTierFilter(t); setPage(1); }}
              className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${
                tierFilter === t
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 bg-white text-ink/80 hover:border-ink/40"
              }`}
            >
              {t === "ALL" ? "全部" : TIER_LABELS[t as WordTier].zh} {counts !== "" && <span className="ml-1 opacity-70">{counts}</span>}
            </button>
          );
        })}
        <input
          className="ml-auto min-w-[180px] flex-1 rounded-lg border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-medium focus:border-ink outline-none transition"
          placeholder="搜索单词或释义..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Word table */}
      <div className="rounded-2xl border-2 border-ink/10 bg-white overflow-hidden stitched-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-ink/10 text-xs uppercase tracking-wide text-ink/55 bg-ink/[0.02]">
              <th className="px-3 py-2 text-left font-extrabold">单词</th>
              <th className="px-3 py-2 text-left font-extrabold">词性</th>
              <th className="px-3 py-2 text-left font-extrabold">释义</th>
              <th className="px-3 py-2 text-left font-extrabold">等级</th>
              <th className="px-3 py-2 text-left font-extrabold">熟练度</th>
              <th className="px-3 py-2 text-left font-extrabold">上次复习</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center font-bold text-ink/40">加载中...</td></tr>
            ) : words.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center font-bold text-ink/40">暂无单词</td></tr>
            ) : (
              words.map((w) => <WordRow key={w.id} word={w} progress={progressByWord.get(w.id) ?? null} />)
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalCount > 50 && (
        <div className="flex items-center justify-between text-sm font-bold text-ink/65">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border-2 border-ink/15 px-4 py-1.5 font-bold hover:bg-ink/5 transition disabled:opacity-30"
          >
            ← 上一页
          </button>
          <span>第 {page} 页 / 共 {Math.ceil(totalCount / 50)} 页 ({totalCount} 词)</span>
          <button
            disabled={page * 50 >= totalCount}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border-2 border-ink/15 px-4 py-1.5 font-bold hover:bg-ink/5 transition disabled:opacity-30"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
