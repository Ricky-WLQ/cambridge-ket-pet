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

  useEffect(() => { loadQuiz(); }, [loadQuiz]);

  useEffect(() => {
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
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-neutral-400">加载中...</div>;
  }
  if (!cur) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-center">
        <p className="text-neutral-500">该主题暂无题目。</p>
        <Link href={`/${examType.toLowerCase()}/grammar`} className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          返回语法主页
        </Link>
      </div>
    );
  }

  const isLast = idx + 1 === questions.length;
  const userIsCorrect = selectedAnswer === cur.correctIndex;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <Link href={`/${examType.toLowerCase()}/grammar`} className="hover:text-neutral-900">← 语法主页</Link>
        <span>第 {idx + 1} / {questions.length} 题</span>
      </div>

      <div className="rounded-2xl border border-neutral-300 bg-white p-6">
        <div className="mb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 font-medium text-blue-700">
            {topicLabel}
          </span>
        </div>

        <div className="mb-5 h-1 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-blue-600 transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>

        <p className="mb-5 text-base text-neutral-900 leading-relaxed">{cur.question}</p>

        <div className="space-y-2">
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
          <div className={`mt-5 rounded-md border p-3 text-sm ${userIsCorrect ? "border-green-300 bg-green-50 text-green-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            <div className="mb-1 font-semibold">{userIsCorrect ? "✓ 正确" : "× 答错了"}</div>
            <div>{cur.explanationZh}</div>
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-between">
        <button
          onClick={prev}
          disabled={idx === 0}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:border-neutral-900 disabled:opacity-30"
        >
          ← 上一题
        </button>
        {isLast && submitted ? (
          <Link
            href={`/${examType.toLowerCase()}/grammar`}
            className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800"
          >
            完成 ✓
          </Link>
        ) : (
          <button
            onClick={advance}
            disabled={!submitted}
            className="rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-30"
          >
            下一题 →
          </button>
        )}
      </div>
    </div>
  );
}
