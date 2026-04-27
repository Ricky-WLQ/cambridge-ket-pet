"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ExamType } from "@prisma/client";
import { MCQOption } from "./MCQOption";
import type { GrammarQuestionDto } from "@/lib/grammar/types";

interface Props { examType: ExamType }

const QUIZ_LENGTH = 10;
const LETTERS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

interface QuestionsResponse {
  questions: GrammarQuestionDto[];
  totalCount: number;
}

interface TopicsResponse {
  topics: { topicId: string; labelZh: string }[];
}

export default function GrammarQuizRunner({ examType }: Props) {
  const sp = useSearchParams();
  const topicId = sp.get("topicId") ?? null;

  const [questions, setQuestions] = useState<GrammarQuestionDto[]>([]);
  const [topicLabel, setTopicLabel] = useState<string>("");
  const [idx, setIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setIdx(0); setSelectedAnswer(null); setSubmitted(false);
    const qs = new URLSearchParams({ examType, count: String(QUIZ_LENGTH) });
    if (topicId) qs.set("topicId", topicId);
    const res = await fetch(`/api/grammar/questions?${qs}`);
    const data: QuestionsResponse = await res.json();
    setQuestions(data.questions);
    setLoading(false);
  }, [examType, topicId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch effect
  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch effect
    if (!topicId) { setTopicLabel("混合主题"); return; }
    fetch(`/api/grammar/topics?examType=${examType}`)
      .then((r) => r.json() as Promise<TopicsResponse>)
      .then((data) => {
        const t = data.topics.find((x) => x.topicId === topicId);
        if (t) setTopicLabel(t.labelZh);
      })
      .catch(() => setTopicLabel(topicId));
  }, [examType, topicId]);

  const cur = questions[idx] ?? null;

  const handleOptionClick = async (optionIdx: number) => {
    if (!cur || submitted) return;
    setSelectedAnswer(optionIdx);
    setSubmitted(true);
    const isCorrect = optionIdx === cur.correctIndex;
    try {
      await fetch("/api/grammar/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: cur.id,
          examType,
          topicId: cur.topicId,
          userAnswer: optionIdx,
          isCorrect,
          questionText: cur.question,
          questionOptions: cur.options,
          correctIndex: cur.correctIndex,
          explanationZh: cur.explanationZh,
        }),
      });
    } catch (err) {
      console.error("[grammar/quiz] progress POST failed:", err);
    }
  };

  const advance = () => {
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
      setSelectedAnswer(null);
      setSubmitted(false);
    }
  };

  const prev = () => {
    if (idx > 0) {
      setIdx(idx - 1);
      setSelectedAnswer(null);
      setSubmitted(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-ink/40 font-bold">加载中...</div>;
  }
  if (!cur) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center">
        <p className="text-ink/65 font-bold">该主题暂无题目。</p>
        <Link href={`/${examType.toLowerCase()}/grammar`} className="mt-4 inline-block text-sm font-bold text-ink hover:underline">
          返回语法主页
        </Link>
      </div>
    );
  }

  const isLast = idx + 1 === questions.length;
  const userIsCorrect = selectedAnswer === cur.correctIndex;

  return (
    <div className="page-section locked-height">
      <div className="site-header">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/${examType.toLowerCase()}/grammar`}
            className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
          >
            ← 语法主页
          </Link>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-mint-tint border-2 border-ink/10 px-4 py-2 text-sm font-extrabold">
            第 <span className="font-mono">{idx + 1}</span> / <span className="font-mono">{questions.length}</span> 题
          </div>
        </div>
      </div>

      <div className="grow-fill flex items-center justify-center min-h-0 overflow-y-auto py-4">
        <div className="w-full max-w-2xl flex flex-col gap-4">
          <div className="relative w-full">
            <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] bg-butter-soft -z-10"></div>
            <div className="rounded-[28px] bg-white border-2 border-ink/10 p-6 sm:p-8 stitched-card flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <span className="pill-tag bg-sky-tint border-2 border-ink/10">
                  {topicLabel}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-mist border border-ink/10 overflow-hidden">
                <div className="h-full bg-ink rounded-full transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug text-ink/90">
                {cur.question}
              </h2>

              <div className="space-y-2.5">
                {cur.options.map((text, i) => {
                  let state: "default" | "selected" | "correct" | "wrong" = "default";
                  if (submitted) {
                    if (i === cur.correctIndex) state = "correct";
                    else if (i === selectedAnswer) state = "wrong";
                  } else if (i === selectedAnswer) {
                    state = "selected";
                  }
                  return (
                    <MCQOption
                      key={i}
                      letter={LETTERS[i]}
                      text={text}
                      state={state}
                      disabled={submitted}
                      onClick={() => handleOptionClick(i)}
                    />
                  );
                })}
              </div>

              {submitted && (
                <div className={`rounded-2xl border-2 p-3 text-sm ${userIsCorrect ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
                  <div className="mb-1 font-extrabold">{userIsCorrect ? "✓ 正确" : "× 答错了"}</div>
                  <div className="font-medium">{cur.explanationZh}</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={idx === 0}
              className="rounded-full bg-white border-2 border-ink/15 text-base font-extrabold px-6 py-3 hover:border-ink transition disabled:opacity-30 flex items-center gap-2"
            >
              <span aria-hidden>←</span> 上一题
            </button>
            {isLast && submitted ? (
              <Link
                href={`/${examType.toLowerCase()}/grammar`}
                className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-3 hover:bg-ink/90 transition"
              >
                完成 ✓
              </Link>
            ) : (
              <button
                onClick={advance}
                disabled={!submitted}
                className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-3 hover:bg-ink/90 transition disabled:opacity-30 flex items-center gap-2"
              >
                下一题 <span aria-hidden>→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
