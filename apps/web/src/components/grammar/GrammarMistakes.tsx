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
      <div className="mb-4 flex items-center text-sm text-neutral-500">
        <Link href={`/${examType.toLowerCase()}/grammar`} className="hover:text-neutral-900">← 语法主页</Link>
      </div>

      <h1 className="mb-2 text-2xl font-semibold">语法错题本</h1>
      <p className="mb-6 text-sm text-neutral-500">所有错题按状态分组，可标记已复习 / 已掌握或重新练习</p>

      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "ALL" ? counts.total : counts[tab.key];
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                isActive
                  ? "border-neutral-900 font-semibold text-neutral-900"
                  : "border-transparent text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {tab.zh} <span className="ml-1 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          加载中...
        </div>
      ) : mistakes.length === 0 ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          {activeTab === "ALL" ? "暂无错题" : `暂无「${STATUS_TABS.find((t) => t.key === activeTab)?.zh}」状态的错题`}
        </div>
      ) : (
        <div className="space-y-3">
          {mistakes.map((m) => {
            const borderColor = m.status === "NEW"
              ? "border-l-red-500"
              : m.status === "REVIEWED"
                ? "border-l-amber-500"
                : "border-l-green-500";
            return (
              <div key={m.id} className={`rounded-md border border-l-4 border-neutral-200 ${borderColor} bg-white p-4`}>
                <p className="mb-3 text-sm text-neutral-900 leading-relaxed">{m.questionText}</p>
                <ul className="mb-3 space-y-1 text-xs">
                  {m.questionOptions.map((opt, i) => {
                    let cls = "text-neutral-700";
                    let badge = "";
                    if (i === m.correctIndex) {
                      cls = "text-green-700 font-medium";
                      badge = " ✓ 正确";
                    } else if (i === m.userAnswer) {
                      cls = "text-red-700 line-through";
                      badge = " ✗ 你的答案";
                    }
                    return <li key={i} className={cls}>{String.fromCharCode(65 + i)}. {opt}{badge}</li>;
                  })}
                </ul>
                <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-700">
                  <span className="font-semibold">解析: </span>{m.explanationZh}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.status === "NEW" && (
                    <>
                      <button
                        onClick={() => updateStatus(m.id, "REVIEWED")}
                        className="rounded-md border border-amber-600 bg-white px-3 py-1 text-xs text-amber-700 hover:bg-amber-50"
                      >
                        标记已复习
                      </button>
                      <button
                        onClick={() => updateStatus(m.id, "MASTERED")}
                        className="rounded-md border border-green-600 bg-white px-3 py-1 text-xs text-green-700 hover:bg-green-50"
                      >
                        标记已掌握
                      </button>
                    </>
                  )}
                  {m.status === "REVIEWED" && (
                    <>
                      <button
                        onClick={() => updateStatus(m.id, "MASTERED")}
                        className="rounded-md border border-green-600 bg-white px-3 py-1 text-xs text-green-700 hover:bg-green-50"
                      >
                        标记已掌握
                      </button>
                      <button
                        onClick={() => updateStatus(m.id, "NEW")}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:border-neutral-900"
                      >
                        重新练习此题
                      </button>
                    </>
                  )}
                  {m.status === "MASTERED" && (
                    <button
                      onClick={() => updateStatus(m.id, "NEW")}
                      className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs text-neutral-700 hover:border-neutral-900"
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
