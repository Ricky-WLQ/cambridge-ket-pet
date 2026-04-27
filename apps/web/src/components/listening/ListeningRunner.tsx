"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AudioPlayer } from "./AudioPlayer";
import { TimerBadge } from "./TimerBadge";
import { TapescriptPanel } from "./TapescriptPanel";
import { PhaseBanner } from "./PhaseBanner";
import { GenerationProgress } from "./GenerationProgress";
import { QuestionRenderer } from "./QuestionRenderer";
import type {
  AudioSegmentRecord,
  ListeningTestPayloadV2,
} from "@/lib/audio/types";

export interface ListeningRunnerProps {
  attemptId: string;
  testId: string;
  mode: "MOCK" | "PRACTICE";
  portal: "ket" | "pet";
}

type RunnerState = "LOADING" | "READY" | "LISTENING" | "REVIEW" | "SUBMITTING";

export function ListeningRunner(props: ListeningRunnerProps) {
  const router = useRouter();
  const [state, setState] = useState<RunnerState>("LOADING");
  const [payload, setPayload] = useState<ListeningTestPayloadV2 | null>(null);
  const [segments, setSegments] = useState<AudioSegmentRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentSegmentId, setCurrentSegmentId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Poll status while loading
  useEffect(() => {
    if (state !== "LOADING") return;
    const t0 = Date.now();
    const poll = async () => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
      const res = await fetch(`/api/listening/tests/${props.testId}/status`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.audioReady) {
        setPayload(data.payload as unknown as ListeningTestPayloadV2);
        setSegments((data.audioSegments ?? []) as AudioSegmentRecord[]);
        setState("READY");
      } else if (data.audioStatus === "FAILED") {
        alert("生成听力测试失败，请重试");
        router.push(`/${props.portal}/listening/new`);
      }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [state, props.testId, props.portal, router]);

  const audioSrc = `/api/listening/${props.attemptId}/audio`;

  const submit = useCallback(
    async (forceSubmit = false) => {
      setState("SUBMITTING");
      const res = await fetch(`/api/tests/${props.attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, forceSubmit }),
      });
      if (res.ok) {
        router.push(`/${props.portal}/listening/result/${props.attemptId}`);
      } else {
        const data = await res.json();
        alert(data.message ?? "提交失败");
        setState(forceSubmit ? "REVIEW" : "LISTENING");
      }
    },
    [answers, props.attemptId, props.portal, router],
  );

  if (state === "LOADING" || !payload) {
    return <GenerationProgress elapsedSec={elapsedSec} />;
  }

  if (state === "READY") {
    return (
      <div className="page-section">
        <div className="mx-auto max-w-3xl w-full px-1 py-8">
          <div className="rounded-3xl bg-white border-2 border-ink/10 p-8 stitched-card">
            <h2 className="text-2xl font-extrabold mb-4">准备开始</h2>
            <p className="mb-4 text-base leading-relaxed text-ink/80">
              {props.mode === "MOCK"
                ? "点击开始后，30 分钟倒计时开始。音频将播放两次，不可暂停、不可倒放。最后 6 分钟为检查和提交时间。"
                : "练习模式 — 无时间限制，音频可自由重播。"}
            </p>
            <button
              className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-3 hover:bg-ink/90 transition"
              onClick={() => setState("LISTENING")}
            >
              开始
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMock = props.mode === "MOCK";

  return (
    <div className="page-section locked-height">
      <div className="site-header">
        <div className="flex items-center gap-2.5">
          <div className="leading-tight">
            <div className="text-base font-extrabold">
              {state === "REVIEW" ? "检查并提交" : "听力进行中"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {isMock && (
            <TimerBadge
              attemptId={props.attemptId}
              onAutoSubmit={() => submit(true)}
              phase={state === "REVIEW" ? "REVIEW" : "LISTENING"}
            />
          )}
          <button
            onClick={() => submit(false)}
            className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-2.5 hover:bg-ink/90 transition disabled:opacity-50"
            disabled={state === "SUBMITTING"}
          >
            {isMock && state === "LISTENING" ? "提交" : "立即提交"}
          </button>
        </div>
      </div>

      <div className="grow-fill min-h-0 overflow-y-auto pr-1">
        <div className="mx-auto max-w-3xl space-y-4">
          <PhaseBanner phase={state === "REVIEW" ? "REVIEW" : "LISTENING"} />

          <AudioPlayer
            src={audioSrc}
            segments={segments}
            autoPlay={isMock}
            controls={{
              playPause: !isMock,
              scrub: !isMock,
              skip10: !isMock,
              speed: !isMock,
              perSegmentReplay: !isMock,
            }}
            onSegmentChange={setCurrentSegmentId}
            onEnded={() => {
              if (isMock) setState("REVIEW");
            }}
          />

          {!isMock && (
            <TapescriptPanel
              parts={payload.parts}
              segments={segments}
              currentSegmentId={currentSegmentId}
              canToggle={true}
              defaultOpen={false}
            />
          )}

          {payload.parts.map((part) => (
            <section
              key={part.partNumber}
              className="rounded-2xl bg-white border-2 border-ink/10 p-5 stitched-card"
            >
              <h3 className="text-xl font-extrabold mb-3">
                第 {part.partNumber} 部分 · {part.instructionZh}
              </h3>
              {part.questions.map((q) => (
                <QuestionRenderer
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                  disabled={false}
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
