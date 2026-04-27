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
  /**
   * Optional override for the submit endpoint. Defaults to the existing
   * `/api/tests/${attemptId}/submit` to preserve current behavior.
   *
   * Used by the diagnose runner wrapper to route submissions to
   * `/api/diagnose/me/section/LISTENING/submit`.
   */
  submitUrl?: string;
  /**
   * Optional override for the post-submit redirect path. Defaults to the
   * existing `/${portal}/listening/result/${attemptId}`. The diagnose
   * runner wrapper passes `/diagnose` so a student lands back on the hub
   * after a section submit (I3).
   */
  redirectAfterSubmit?: string;
  /**
   * When true, the runner is rendered in view-only mode — no submit button,
   * a "练习模式 — 不计分" banner is shown. Used by the diagnose replay page
   * (I1).
   */
  readOnly?: boolean;
  /**
   * Optional override for the redirect when audio generation fails. Defaults
   * to `/${portal}/listening/new` (the regular practice flow). Diagnose
   * wrapper sets this to `/diagnose` so a student lands back on the hub
   * instead of the practice-listening start page.
   */
  audioFailedRedirect?: string;
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
        router.push(
          props.audioFailedRedirect ?? `/${props.portal}/listening/new`,
        );
      }
    };
    poll();
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [state, props.testId, props.portal, router]);

  const audioSrc = `/api/listening/${props.attemptId}/audio`;

  // Default preserves existing call-site behavior; diagnose wrapper overrides.
  const submitUrl =
    props.submitUrl ?? `/api/tests/${props.attemptId}/submit`;
  const redirectAfterSubmit = props.redirectAfterSubmit;
  const readOnly = props.readOnly ?? false;

  const submit = useCallback(
    async (forceSubmit = false) => {
      setState("SUBMITTING");
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, forceSubmit }),
      });
      if (res.ok) {
        const target =
          redirectAfterSubmit ??
          `/${props.portal}/listening/result/${props.attemptId}`;
        router.push(target);
      } else {
        const data = await res.json();
        alert(data.message ?? "提交失败");
        setState(forceSubmit ? "REVIEW" : "LISTENING");
      }
    },
    [
      answers,
      props.attemptId,
      props.portal,
      router,
      submitUrl,
      redirectAfterSubmit,
    ],
  );

  if (state === "LOADING" || !payload) {
    return <GenerationProgress elapsedSec={elapsedSec} />;
  }

  if (state === "READY") {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">准备开始</h2>
        <p className="mb-2">
          {props.mode === "MOCK"
            ? "点击开始后，30 分钟倒计时开始。音频将播放两次，不可暂停、不可倒放。最后 6 分钟为检查和提交时间。"
            : "练习模式 — 无时间限制，音频可自由重播。"}
        </p>
        <button
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg"
          onClick={() => setState("LISTENING")}
        >
          开始
        </button>
      </div>
    );
  }

  const isMock = props.mode === "MOCK";

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {isMock && (
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold">
            {state === "REVIEW" ? "检查并提交" : "听力进行中"}
          </span>
          <TimerBadge
            attemptId={props.attemptId}
            onAutoSubmit={() => submit(true)}
            phase={state === "REVIEW" ? "REVIEW" : "LISTENING"}
          />
        </div>
      )}
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

      <div className="mt-6">
        {payload.parts.map((part) => (
          <section key={part.partNumber} className="mb-8">
            <h3 className="text-xl font-semibold mb-2">
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

      {readOnly ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          练习模式 — 不计分
        </div>
      ) : (
        <button
          onClick={() => submit(false)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg"
          disabled={state === "SUBMITTING"}
        >
          {isMock && state === "LISTENING" ? "提交" : "立即提交"}
        </button>
      )}
    </div>
  );
}
