"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { RubricBar } from "./RubricBar";
import { TranscriptViewer } from "./TranscriptViewer";

interface WeakPoint {
  tag: string;
  quote: string;
  suggestion: string;
}

interface Rubric {
  grammarVocab: number;
  discourseManagement: number;
  pronunciation: number;
  interactive: number;
  overall: number;
  justification: string;
  weakPoints: WeakPoint[];
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  part: number;
}

type SpeakingStatus =
  | "IDLE"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "SCORING"
  | "SCORED"
  | "FAILED";

interface Props {
  attemptId: string;
  level: "KET" | "PET";
  initialTranscript: Turn[];
  initialRubric: Rubric | null;
  initialStatus: SpeakingStatus;
  initialError: string | null;
  initialRawScore: number | null;
  initialScaledScore: number | null;
  initialTotalPossible: number | null;
}

const POLL_INTERVAL_MS = 2_000;
const POLL_DEADLINE_MS = 2 * 60_000;

function isTerminal(status: SpeakingStatus): boolean {
  return status === "SCORED" || status === "FAILED";
}

export function SpeakingResult({
  attemptId,
  level,
  initialTranscript,
  initialRubric,
  initialStatus,
  initialError,
  initialRawScore,
  initialScaledScore,
  initialTotalPossible,
}: Props) {
  const [rubric, setRubric] = useState<Rubric | null>(initialRubric);
  const [status, setStatus] = useState<SpeakingStatus>(initialStatus);
  const [error, setError] = useState<string | null>(initialError);
  const [rawScore, setRawScore] = useState<number | null>(initialRawScore);
  const [scaledScore, setScaledScore] = useState<number | null>(
    initialScaledScore,
  );
  const [totalPossible, setTotalPossible] = useState<number | null>(
    initialTotalPossible,
  );

  useEffect(() => {
    if (isTerminal(status)) return;
    const deadline = Date.now() + POLL_DEADLINE_MS;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          speakingStatus: SpeakingStatus;
          rubricScores: Rubric | null;
          speakingError: string | null;
          rawScore?: number | null;
          scaledScore?: number | null;
          totalPossible?: number | null;
        };
        if (cancelled) return;
        setStatus(json.speakingStatus);
        if (json.rubricScores) setRubric(json.rubricScores);
        if (json.speakingError) setError(json.speakingError);
        if (typeof json.rawScore === "number") setRawScore(json.rawScore);
        if (typeof json.scaledScore === "number")
          setScaledScore(json.scaledScore);
        if (typeof json.totalPossible === "number")
          setTotalPossible(json.totalPossible);
      } catch {
        // transient — keep polling until deadline
      }
    };
    const id = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(id);
        if (!cancelled) {
          setError((e) => e ?? "评分超时,请稍后刷新或重做。");
        }
        return;
      }
      void tick();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [attemptId, status]);

  const portalBase = level === "KET" ? "/ket" : "/pet";
  const showSpinner =
    status === "SUBMITTED" || status === "SCORING" || status === "IN_PROGRESS";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">口语结果 — {level}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            考官 Mina · 全程 AI 对话
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/history"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            ← 返回历史记录
          </Link>
          <Link
            href={portalBase}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-100"
          >
            返回 {level} 门户
          </Link>
        </div>
      </header>

      {showSpinner && !rubric && (
        <div
          className="rounded-md border border-neutral-300 bg-slate-50 p-4 text-neutral-700"
          role="status"
          aria-live="polite"
        >
          正在评分,请稍候…
        </div>
      )}

      {error && (
        <div
          className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </div>
      )}

      {rubric && (
        <>
          <section className="rounded-md bg-slate-100 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xl font-semibold">
                得分:{rawScore ?? 0} / {totalPossible ?? 20}
              </p>
              {typeof scaledScore === "number" && (
                <p className="text-base text-neutral-600">
                  折算 {scaledScore}%
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              四项评分(0–5)按 Cambridge Speaking 评分标准
            </p>
          </section>

          <section className="rounded-md border border-neutral-300 bg-white p-4">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-neutral-900">
                评分细项
              </h2>
              <span className="tabular-nums text-2xl font-semibold text-emerald-600">
                {rubric.overall.toFixed(1)}
                <span className="ml-1 text-sm text-neutral-500">/ 5</span>
              </span>
            </div>
            <div className="space-y-3">
              <RubricBar
                label="Grammar & Vocabulary"
                score={rubric.grammarVocab}
              />
              <RubricBar
                label="Discourse Management"
                score={rubric.discourseManagement}
              />
              <RubricBar label="Pronunciation" score={rubric.pronunciation} />
              <RubricBar
                label="Interactive Communication"
                score={rubric.interactive}
              />
            </div>
            {rubric.justification && (
              <p className="mt-4 border-t border-neutral-200 pt-3 text-sm leading-relaxed text-neutral-700">
                {rubric.justification}
              </p>
            )}
          </section>

          {rubric.weakPoints?.length > 0 && (
            <section className="rounded-md border border-neutral-300 bg-white p-4">
              <h2 className="text-base font-semibold text-neutral-900">
                易错点
              </h2>
              <ul className="mt-3 space-y-3">
                {rubric.weakPoints.map((wp, i) => (
                  <li
                    key={i}
                    className="rounded border border-neutral-200 bg-slate-50 p-3 text-sm"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {wp.tag}
                    </span>
                    <p className="mt-1 italic text-neutral-700">
                      “{wp.quote}”
                    </p>
                    <p className="mt-1 text-neutral-900">
                      建议:{wp.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <TranscriptViewer
        transcript={initialTranscript}
        defaultOpen={!rubric}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-6">
        <Link
          href="/history"
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
        >
          ← 返回历史记录
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${portalBase}/speaking/new`}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            新的口语测试
          </Link>
          <Link
            href={portalBase}
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            返回 {level} 门户
          </Link>
        </div>
      </div>
    </div>
  );
}
