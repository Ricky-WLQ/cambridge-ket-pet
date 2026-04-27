"use client";

import { useEffect, useState } from "react";
import { createAssignmentAction } from "@/lib/assignmentActions";

type ExamType = "KET" | "PET";
type Kind = "READING" | "WRITING" | "LISTENING" | "VOCAB" | "GRAMMAR";
type Tier = "CORE" | "RECOMMENDED" | "EXTRA";
type GrammarTopicOption = {
  id: string;
  topicId: string;
  labelZh: string;
  category: string;
};

const PAPER_KINDS = ["READING", "WRITING", "LISTENING"] as const;

const PARTS: Record<ExamType, Record<(typeof PAPER_KINDS)[number], number[]>> = {
  KET: {
    READING: [1, 2, 3, 4, 5],
    WRITING: [6, 7],
    LISTENING: [1, 2, 3, 4, 5],
  },
  PET: {
    READING: [1, 2, 3, 4, 5, 6],
    WRITING: [1, 2],
    LISTENING: [1, 2, 3, 4],
  },
};

const KIND_LABEL: Record<Kind, string> = {
  READING: "阅读",
  WRITING: "写作",
  LISTENING: "听力",
  VOCAB: "词汇",
  GRAMMAR: "语法",
};

const TIER_LABEL: Record<Tier | "ALL", string> = {
  ALL: "全部等级",
  CORE: "必修核心 ★★★",
  RECOMMENDED: "推荐 ★★",
  EXTRA: "拓展 ★",
};

export default function NewAssignmentForm({
  classId,
  defaultExamType,
}: {
  classId: string;
  defaultExamType: ExamType;
}) {
  const [examType, setExamType] = useState<ExamType>(defaultExamType);
  const [kind, setKind] = useState<Kind>("READING");
  const [part, setPart] = useState<string>("ANY");
  const [targetTier, setTargetTier] = useState<Tier | null>(null);
  const [targetWordCount, setTargetWordCount] = useState<number>(100);
  const [targetTopicId, setTargetTopicId] = useState<string | null>(null);
  const [targetMinScore, setTargetMinScore] = useState<number>(70);
  const [topics, setTopics] = useState<GrammarTopicOption[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isVocab = kind === "VOCAB";
  const isGrammar = kind === "GRAMMAR";
  const isPaperKind = !isVocab && !isGrammar;
  const parts = isPaperKind
    ? PARTS[examType][kind as (typeof PAPER_KINDS)[number]]
    : [];

  useEffect(() => {
    if (kind !== "GRAMMAR") return;
    fetch(`/api/grammar/topics?examType=${examType}`)
      .then((r) => r.json())
      .then((data) => setTopics(Array.isArray(data?.topics) ? data.topics : []))
      .catch(() => {});
  }, [kind, examType]);

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        try {
          await createAssignmentAction(fd);
        } catch (e) {
          setSubmitting(false);
          alert(e instanceof Error ? e.message : "创建作业失败");
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="classId" value={classId} />

      <div>
        <label className="mb-1 block text-sm font-bold">标题</label>
        <input
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="例如：本周 KET Reading Part 3 练习"
          className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-bold">说明（可选）</label>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          placeholder="给学生的简短说明、提示或鼓励"
          className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-bold">科目</label>
          <div className="flex gap-2">
            {(["KET", "PET"] as const).map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => {
                  setExamType(et);
                  setPart("ANY");
                }}
                className={`flex-1 rounded-full border-2 px-3 py-2 text-sm font-bold transition ${
                  examType === et
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 bg-white hover:bg-ink/5"
                }`}
              >
                {et}
              </button>
            ))}
          </div>
          <input type="hidden" name="examType" value={examType} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-bold">题型</label>
          <div className="flex flex-wrap gap-2">
            {(
              ["READING", "WRITING", "LISTENING", "VOCAB", "GRAMMAR"] as const
            ).map((k) => {
              // P-Skill-Color canonical mapping
              const tileMap: Record<Kind, string> = {
                READING: "tile-lavender",
                WRITING: "tile-butter",
                LISTENING: "tile-sky",
                VOCAB: "tile-mint",
                GRAMMAR: "tile-cream",
              };
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setPart("ANY");
                  }}
                  className={`flex-1 rounded-full border-2 px-3 py-2 text-sm font-bold transition ${
                    kind === k
                      ? "border-ink bg-ink text-white"
                      : `border-ink/15 ${tileMap[k]} hover:border-ink/30`
                  }`}
                >
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
          <input type="hidden" name="kind" value={kind} />
        </div>
      </div>

      {isPaperKind && (
        <div>
          <label className="mb-1 block text-sm font-bold">
            Part（可选 — 留「任意」则该题型任意 Part 均计入）
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPart("ANY")}
              className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${
                part === "ANY"
                  ? "border-ink bg-ink text-white"
                  : "border-ink/15 bg-white hover:bg-ink/5"
              }`}
            >
              任意
            </button>
            {parts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPart(String(p))}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${
                  part === String(p)
                    ? "border-ink bg-ink text-white"
                    : "border-ink/15 bg-white hover:bg-ink/5"
                }`}
              >
                Part {p}
              </button>
            ))}
          </div>
          <input type="hidden" name="part" value={part} />
        </div>
      )}

      {isVocab && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold">目标等级</label>
            <div className="flex flex-wrap gap-2">
              {(["ALL", "CORE", "RECOMMENDED", "EXTRA"] as const).map((t) => {
                const selected =
                  (t === "ALL" && targetTier === null) || targetTier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setTargetTier(t === "ALL" ? null : (t as Tier))
                    }
                    className={`rounded-full border-2 px-3 py-1.5 text-sm font-bold transition ${
                      selected
                        ? "border-ink bg-ink text-white"
                        : "border-ink/15 bg-white hover:bg-ink/5"
                    }`}
                  >
                    {TIER_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <input
              type="hidden"
              name="targetTier"
              value={targetTier ?? "ALL"}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">需掌握词数</label>
            <input
              name="targetWordCount"
              type="number"
              min={1}
              max={4000}
              value={targetWordCount}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setTargetWordCount(Number.isFinite(v) ? v : 0);
              }}
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
            />
            <p className="mt-1 text-xs font-medium text-ink/60">
              学生需在所选等级中达到熟练度 ≥ 4 的单词数量。
            </p>
          </div>
        </div>
      )}

      {isGrammar && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-bold">目标主题</label>
            <select
              value={targetTopicId ?? ""}
              onChange={(e) =>
                setTargetTopicId(e.target.value === "" ? null : e.target.value)
              }
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
            >
              <option value="">全部主题</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.category}] {t.labelZh}
                </option>
              ))}
            </select>
            <input
              type="hidden"
              name="targetTopicId"
              value={targetTopicId ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold">
              正确率达标线 (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={targetMinScore}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10);
                setTargetMinScore(Number.isFinite(v) ? v : 0);
              }}
              name="minScore"
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
            />
            <p className="mt-1 text-xs font-medium text-ink/60">
              学生需在所选主题（或全部主题）至少答 10 题，且正确率达到此线。
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {isPaperKind && (
          <div>
            <label className="mb-1 block text-sm font-bold">
              最低及格分（可选，0-100）
            </label>
            <input
              name="minScore"
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="例如：70"
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
            />
            <p className="mt-1 text-xs font-medium text-ink/60">
              留空则任何已批改答卷均视为完成
            </p>
          </div>
        )}

        <div className={isPaperKind ? "" : "sm:col-span-2"}>
          <label className="mb-1 block text-sm font-bold">
            截止时间（可选）
          </label>
          <input
            name="dueAt"
            type="datetime-local"
            className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-extrabold text-white hover:bg-ink/90 transition disabled:opacity-50"
        >
          {submitting ? "保存中…" : "保存作业"}
        </button>
      </div>
    </form>
  );
}
