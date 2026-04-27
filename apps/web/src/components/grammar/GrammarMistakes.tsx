"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ExamType, NoteStatus } from "@prisma/client";
import type { GrammarMistakeDto, GrammarMistakeCounts } from "@/lib/grammar/types";

interface Props { examType: ExamType }

const STATUS_TABS: Array<{ key: "ALL" | NoteStatus; zh: string }> = [
  { key: "ALL",      zh: "全部" },
  { key: "NEW",      zh: "待复习" },
  { key: "REVIEWED", zh: "已复习" },
  { key: "MASTERED", zh: "已掌握" },
];

interface MistakesResponse {
  data: GrammarMistakeDto[];
  counts: GrammarMistakeCounts;
}

export default function GrammarMistakes({ examType }: Props) {
  const [activeTab, setActiveTab] = useState<"ALL" | NoteStatus>("ALL");
  const [mistakes, setMistakes] = useState<GrammarMistakeDto[]>([]);
  const [counts, setCounts] = useState<GrammarMistakeCounts>({ NEW: 0, REVIEWED: 0, MASTERED: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ examType, pageSize: "100" });
    if (activeTab !== "ALL") qs.set("status", activeTab);
    const res = await fetch(`/api/grammar/mistakes?${qs}`);
    const data: MistakesResponse = await res.json();
    setMistakes(data.data);
    setCounts(data.counts);
    setLoading(false);
  }, [examType, activeTab]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch effect
  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, newStatus: NoteStatus) => {
    await fetch("/api/grammar/mistakes", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    load();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center text-sm font-bold text-ink/70">
        <Link href={`/${examType.toLowerCase()}/grammar`} className="hover:text-ink hover:underline">← 语法主页</Link>
      </div>

      <h1 className="mb-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.05]">
        <span className="marker-yellow-thick">语法错题本</span>
      </h1>
      <p className="mt-3 mb-6 text-base sm:text-lg text-ink/75 max-w-xl leading-relaxed">所有错题按状态分组，可标记已复习 / 已掌握或重新练习</p>

      <div className="mb-6 flex flex-wrap items-center gap-2 border-b-2 border-ink/10 pb-2">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "ALL" ? counts.total : counts[tab.key];
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pill-tag transition ${
                isActive
                  ? "bg-ink text-white"
                  : "bg-white border-2 border-ink/15 hover:border-ink"
              }`}
            >
              {tab.zh} <span className="ml-1 opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-2xl border-2 border-ink/10 bg-mist p-6 text-center text-sm text-ink/65 font-bold stitched-card">
          加载中...
        </div>
      ) : mistakes.length === 0 ? (
        <div className="rounded-2xl border-2 border-ink/10 bg-mist p-8 text-center text-sm text-ink/65 font-bold stitched-card">
          {activeTab === "ALL" ? "暂无错题" : `暂无「${STATUS_TABS.find((t) => t.key === activeTab)?.zh}」状态的错题`}
        </div>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => {
            const borderColor = m.status === "NEW"
              ? "border-l-rose-500"
              : m.status === "REVIEWED"
                ? "border-l-amber-500"
                : "border-l-emerald-500";
            return (
              <div key={m.id} className={`rounded-2xl bg-white border-2 border-ink/10 border-l-[6px] ${borderColor} p-4 sm:p-5 stitched-card`}>
                <p className="mb-3 text-base font-bold leading-snug text-ink/90">{m.questionText}</p>
                <ul className="mb-3 space-y-1 text-sm">
                  {m.questionOptions.map((opt, i) => {
                    let cls = "text-ink/70";
                    let badge = "";
                    if (i === m.correctIndex) {
                      cls = "text-emerald-700 font-bold";
                      badge = " ✓ 正确";
                    } else if (i === m.userAnswer) {
                      cls = "text-rose-700 line-through";
                      badge = " ✗ 你的答案";
                    }
                    return <li key={i} className={cls}>{String.fromCharCode(65 + i)}. {opt}{badge}</li>;
                  })}
                </ul>
                <div className="mb-3 rounded-xl bg-mist border border-ink/10 p-3 text-sm text-ink/80">
                  <span className="font-extrabold">解析: </span>{m.explanationZh}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.status === "NEW" && (
                    <>
                      <button
                        onClick={() => updateStatus(m.id, "REVIEWED")}
                        className="rounded-full bg-white border-2 border-amber-600 text-amber-700 text-xs font-extrabold px-3.5 py-1.5 hover:bg-amber-50 transition"
                      >
                        标记已复习
                      </button>
                      <button
                        onClick={() => updateStatus(m.id, "MASTERED")}
                        className="rounded-full bg-white border-2 border-emerald-600 text-emerald-700 text-xs font-extrabold px-3.5 py-1.5 hover:bg-emerald-50 transition"
                      >
                        标记已掌握
                      </button>
                    </>
                  )}
                  {m.status === "REVIEWED" && (
                    <>
                      <button
                        onClick={() => updateStatus(m.id, "MASTERED")}
                        className="rounded-full bg-white border-2 border-emerald-600 text-emerald-700 text-xs font-extrabold px-3.5 py-1.5 hover:bg-emerald-50 transition"
                      >
                        标记已掌握
                      </button>
                      <button
                        onClick={() => updateStatus(m.id, "NEW")}
                        className="rounded-full bg-white border-2 border-ink/15 text-ink/80 text-xs font-extrabold px-3.5 py-1.5 hover:border-ink transition"
                      >
                        重新练习此题
                      </button>
                    </>
                  )}
                  {m.status === "MASTERED" && (
                    <button
                      onClick={() => updateStatus(m.id, "NEW")}
                      className="rounded-full bg-white border-2 border-ink/15 text-ink/80 text-xs font-extrabold px-3.5 py-1.5 hover:border-ink transition"
                    >
                      重新学习
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
