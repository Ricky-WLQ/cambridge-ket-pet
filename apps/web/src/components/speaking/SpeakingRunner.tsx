"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createMinaTrtcSession,
  type MinaTrtcCredentials,
  type MinaTrtcSession,
  type StreamMessage,
} from "@/lib/speaking/trtc-client";
import {
  createClientTranscriptBuffer,
  type ClientTranscriptBuffer,
} from "@/lib/speaking/client-transcript-buffer";
import { MinaAvatarPanel } from "./MinaAvatarPanel";
import { StatusPill, type SpeakingStatusLabel } from "./StatusPill";
import { PhotoPanel } from "./PhotoPanel";
import { PartProgressBar } from "./PartProgressBar";
import { EndTestButton } from "./EndTestButton";

interface SpeakingPart {
  partNumber: number;
  title: string;
  targetMinutes: number;
  photoKey: string | null;
  examinerScript: string[];
}

interface SpeakingTestContext {
  parts: SpeakingPart[];
  initialGreeting: string;
  photoUrls: Record<string, string>;
  level: "KET" | "PET";
}

interface SessionInit {
  akoolSessionId: string;
  streamType: "trtc";
  trtc: MinaTrtcCredentials;
  test: SpeakingTestContext;
}

interface Props {
  attemptId: string;
  level: "KET" | "PET";
  /**
   * Optional override for the post-submit redirect path. Defaults to
   * `/${base}/speaking/result/${attemptId}` (the regular practice flow's
   * result page). The diagnose runner page passes `/diagnose` so a student
   * lands back on the hub after submitting the speaking section — the
   * regular result page checks `test.kind === "SPEAKING"` and 404s on
   * diagnose attempts (kind=DIAGNOSE).
   */
  redirectAfterSubmit?: string;
}

function targetTotalMinutes(parts: SpeakingPart[]) {
  return parts.reduce((a, p) => a + p.targetMinutes, 0);
}

export function SpeakingRunner({ attemptId, level, redirectAfterSubmit }: Props) {
  const [status, setStatus] = useState<SpeakingStatusLabel>("connecting");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const [testCtx, setTestCtx] = useState<SpeakingTestContext | null>(null);
  const sessionRef = useRef<MinaTrtcSession | null>(null);
  const bufRef = useRef<ClientTranscriptBuffer>(createClientTranscriptBuffer());
  const currentPartRef = useRef(1);
  const endedRef = useRef(false);
  const startedAtRef = useRef<number>(0);
  const submittedRef = useRef(false);

  // Script-progression cursor: how many examiner questions have already
  // been issued in currentPart. Initialised to 1 because bootstrap
  // pushes parts[0].examinerScript[0] before the first /reply fires.
  // After each /reply that does NOT advance, increment by 1. On
  // advancePart, reset to 1 (the [[PART:M]] reply consumed script[0] of
  // the new part). The Python examiner agent uses this as its
  // deterministic cursor so it never cycles back to script[0] of an
  // exhausted part — root cause of the multi-loop bug observed in QA.
  const assistantTurnsInPartRef = useRef(1);

  // Concurrency guard: Akool VAD splits multi-sentence utterances into
  // multiple `fin=true` STT segments (e.g. "I don't like X. because Y."
  // → two segments). Without this guard, two parallel /reply calls fire
  // and two assistant turns come back. We serialize: while one /reply
  // is in flight, mark `pendingFireRef`; after the current call
  // completes, fire ONE more /reply with fresh history if pending was
  // set, looping until clear.
  const replyInFlightRef = useRef(false);
  const pendingFireRef = useRef(false);

  // Debounce window: when a user-final stream-message arrives, we wait
  // USER_FINAL_DEBOUNCE_MS for additional finals before actually firing
  // /reply. Akool's server-side VAD (silence_duration_ms) is set to
  // 2000ms so a "thinking pause" within an utterance is captured as
  // one segment, but if a candidate's pause runs slightly longer than
  // that or Akool's VAD is fooled by a breath, this client-side
  // window catches the next final and merges it into the same /reply
  // snapshot. Total max pause before /reply fires is
  // silence_duration_ms (2000) + USER_FINAL_DEBOUNCE_MS = ~2.6s.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    currentPartRef.current = currentPart;
    bufRef.current.setCurrentPart(currentPart);
  }, [currentPart]);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    try {
      await fetch(`/api/speaking/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientTranscript: bufRef.current.snapshot() }),
        keepalive: true,
      });
    } finally {
      await sessionRef.current?.close();
      const base = level === "KET" ? "/ket" : "/pet";
      const target =
        redirectAfterSubmit ?? `${base}/speaking/result/${attemptId}`;
      window.location.href = target;
    }
  }, [attemptId, level, redirectAfterSubmit]);

  // One /reply round-trip — snapshot history, call API, push reply to
  // Akool, advance/end as flagged. Only the loop in handleMessage may
  // call this; it owns the in-flight latch.
  const runReplyTurn = useCallback(async () => {
    setStatus("thinking");
    const history = bufRef.current.snapshot().map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch(`/api/speaking/${attemptId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          currentPart: currentPartRef.current,
          currentPartQuestionCount: assistantTurnsInPartRef.current,
        }),
      });
      if (!res.ok) throw new Error(`/reply HTTP ${res.status}`);
      const json = (await res.json()) as {
        reply: string;
        flags: {
          advancePart: number | null;
          sessionEnd: boolean;
          retry?: boolean;
        };
      };

      // Cursor maintenance: a normal turn consumed script[N], so the
      // next turn should ask script[N+1]. A part-advance turn consumed
      // script[0] of the destination part, so the cursor for the new
      // part starts at 1. A retry filler does not consume any script
      // item.
      //
      // We update the part RAW state AND the synchronous mirrors
      // (currentPartRef + bufRef.setCurrentPart) in the same tick. The
      // useEffect on `currentPart` would do the mirrors too, but it only
      // fires after React's commit phase — meanwhile Akool's bot
      // stream-message confirming our [[PART:M]] reply could arrive on
      // the TRTC channel and the buffer would tag it with the OLD part.
      // The sync mirrors close that window.
      if (json.flags.retry) {
        // no cursor change
      } else if (json.flags.advancePart != null) {
        const next = json.flags.advancePart;
        setCurrentPart(next);
        currentPartRef.current = next;
        bufRef.current.setCurrentPart(next);
        assistantTurnsInPartRef.current = 1;
      } else {
        assistantTurnsInPartRef.current += 1;
      }

      setStatus("speaking");
      await sessionRef.current?.sendChat(json.reply);

      if (json.flags.sessionEnd) {
        endedRef.current = true;
        setStatus("ended");
        setTimeout(() => void submit(), 1200);
      } else {
        setStatus("listening");
      }
    } catch (err) {
      console.error("[runner] reply failed", err);
      setStatus("listening");
    }
  }, [attemptId, submit]);

  // Drain pending replies — one /reply at a time, looping while more
  // user input arrived during flight. Called from the debounce timer
  // callback. Splits the in-flight latch out of handleMessage so the
  // debounce path can drive it independently of the stream-message
  // event path.
  const drainReplies = useCallback(async () => {
    if (replyInFlightRef.current) {
      pendingFireRef.current = true;
      return;
    }
    replyInFlightRef.current = true;
    try {
      do {
        pendingFireRef.current = false;
        await runReplyTurn();
      } while (pendingFireRef.current && !endedRef.current);
    } finally {
      replyInFlightRef.current = false;
    }
  }, [runReplyTurn]);

  const USER_FINAL_DEBOUNCE_MS = 600;

  const handleMessage = useCallback(
    async (msg: StreamMessage) => {
      if (endedRef.current) return;
      bufRef.current.captureStreamMessage(msg);
      if (msg.type !== "chat" || !msg.fin) return;
      if (msg.pld.from !== "user" || !msg.pld.text) return;

      // ECHO-CANCEL: Akool's avatar TTS-es every user STT verbatim ~10ms
      // after recognition, regardless of `mode_type:1` (Retelling) at
      // session/create OR runtime `set-params(mode:1)` (both ACK'd 1000
      // by Akool — confirmed in browser console — yet behavior persists).
      // Send `interrupt` the instant we see user STT to abort that echo
      // TTS in flight. Our sendChat(reply) below then fills the silence
      // with the actual examiner question.
      //
      // The interrupt is also harmless if the avatar is already silent
      // (no in-flight TTS to abort), so we can fire it unconditionally
      // on every user-final turn.
      try {
        await sessionRef.current?.interrupt();
      } catch (err) {
        console.warn("[runner] interrupt(echo-cancel) failed", err);
      }

      // If a /reply is already running, the user spoke during Mina's
      // thinking. Queue the segment so drainReplies picks it up after
      // the current call finishes. Skip the debounce — there's no
      // in-flight call to debounce against.
      if (replyInFlightRef.current) {
        pendingFireRef.current = true;
        return;
      }

      // Debounce: postpone the actual /reply by USER_FINAL_DEBOUNCE_MS.
      // If another user-final arrives before the timer fires (Akool
      // emitted a second segment for the same logical utterance), the
      // timer is reset and only ONE /reply call eventually fires with
      // the merged history. This catches the "I don't like X. because
      // Y." pattern where the candidate's mid-thought pause exceeds
      // Akool's silence_duration_ms.
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void drainReplies();
      }, USER_FINAL_DEBOUNCE_MS);
    },
    [drainReplies],
  );

  // Bootstrap. React Strict Mode runs effects twice in dev, which would
  // create two Akool sessions + two TRTC peer connections (the first's
  // cleanup tears down WebRTC mid-negotiation). Use a ref-guarded latch so
  // the second strict-mode invocation is a no-op.
  //
  // The cleanup function is intentionally a no-op: Strict Mode's
  // between-mounts cleanup must NOT cancel the in-flight fetch or close
  // the just-created Akool/TRTC session — doing so would tear down work
  // the latch is supposed to preserve. (We tried AbortController here in
  // a previous iteration; it killed the fetch before it could return,
  // leaving the page hung in "正在连接".)
  //
  // Real-unmount cleanup of side effects is handled by:
  //   - safetyCap timer (Task 22) → submit() if elapsed > target+3
  //   - beforeunload beacon → submit()
  //   - End Test button → submit()
  //   - onDisconnected callback → fire-and-forget /submit
  //   - bootstrap-error catch → fire-and-forget /submit
  // plus Akool's 15-min session-duration safety net for any edge case.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) throw new Error(`/session HTTP ${res.status}`);
        const init = (await res.json()) as SessionInit;
        setTestCtx(init.test);
        startedAtRef.current = Date.now();

        const session = await createMinaTrtcSession({
          credentials: init.trtc,
          onMessage: handleMessage,
          onRemoteVideoAvailable: (userId) => {
            // createMinaTrtcSession auto-subscribes the remote video to the
            // "mina-video" DOM mount point. We just need to clear the
            // "loading Mina…" placeholder.
            setRemoteUserId(userId);
          },
          onDisconnected: () => {
            setError("连接已断开,请刷新重试。");
            setStatus("ended");
            // Best-effort: close the Akool session server-side so the avatar
            // is freed up immediately rather than waiting for the 15-min
            // duration timeout.
            void fetch(`/api/speaking/${attemptId}/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientTranscript: bufRef.current.snapshot() }),
              keepalive: true,
            }).catch(() => {});
          },
        });
        sessionRef.current = session;
        setStatus("listening");

        // Bootstrap utterance: greeting + first question of Part 1.
        // The greeting alone says "let's begin a few questions about
        // yourself" but doesn't actually ASK anything, so Mina would sit
        // silent until the candidate speaks. Pushing the first question
        // immediately after gives her the opening turn she's supposed to
        // have. After this, the examiner agent's /reply output drives
        // every subsequent question — including part-transition questions,
        // which the agent embeds in its reply text.
        if (init.test.initialGreeting) {
          await session.sendChat(init.test.initialGreeting);
        }
        const firstQuestion = init.test.parts[0]?.examinerScript[0];
        if (firstQuestion) {
          await session.sendChat(firstQuestion);
        }
      } catch (err) {
        console.error("[runner] bootstrap failed", err);
        setError((err as Error).message);
        // Close any Akool session that /session managed to create before the
        // failure — without this, the avatar's single-concurrency slot stays
        // occupied for 15 min.
        void fetch(`/api/speaking/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientTranscript: [] }),
          keepalive: true,
        }).catch(() => {});
      }
    })();

    return () => {
      // Intentional no-op — see block comment above. Side-effect cleanup
      // is owned by other handlers, not by Strict Mode's between-mounts
      // cleanup which fires whether we want it to or not.
    };
  }, [attemptId, handleMessage]);

  // Safety cap: auto-submit if elapsed > (target + 3 min)
  useEffect(() => {
    if (!testCtx) return;
    const capMs = (targetTotalMinutes(testCtx.parts) + 3) * 60_000;
    const t = setInterval(() => {
      if (!startedAtRef.current) return;
      if (Date.now() - startedAtRef.current > capMs && !endedRef.current) {
        endedRef.current = true;
        setStatus("ended");
        void submit();
      }
    }, 5_000);
    return () => clearInterval(t);
  }, [testCtx, submit]);

  // beforeunload → beacon submit
  useEffect(() => {
    const handler = () => {
      if (submittedRef.current) return;
      try {
        const body = JSON.stringify({ clientTranscript: bufRef.current.snapshot() });
        navigator.sendBeacon(
          `/api/speaking/${attemptId}/submit`,
          new Blob([body], { type: "application/json" }),
        );
        submittedRef.current = true;
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [attemptId]);

  const currentPartObj = useMemo(
    () => testCtx?.parts.find((p) => p.partNumber === currentPart) ?? null,
    [testCtx, currentPart],
  );
  const photoUrl = currentPartObj?.photoKey
    ? testCtx?.photoUrls[currentPartObj.photoKey] ?? null
    : null;

  if (error) {
    return (
      <div className="page-section">
        <div className="mx-auto max-w-md w-full px-1 py-12 text-center">
          <div className="rounded-3xl bg-white border-2 border-ink/10 p-8 stitched-card">
            <p className="text-base font-bold text-red-600">{error}</p>
            <a
              className="mt-4 inline-block rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
              href={`/${level.toLowerCase()}/speaking/new`}
            >
              返回
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section locked-height">
      <div className="site-header">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          {testCtx && (
            <PartProgressBar totalParts={testCtx.parts.length} currentPart={currentPart} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <EndTestButton onConfirm={submit} disabled={status === "ended"} />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-4 grow-fill min-h-0 items-start">
        <div className="flex justify-center min-h-0">
          <MinaAvatarPanel remoteUserId={remoteUserId} />
        </div>
        <div className="flex justify-center min-h-0">
          <PhotoPanel photoUrl={photoUrl ?? null} caption={currentPartObj?.title} />
        </div>
      </div>
    </div>
  );
}
