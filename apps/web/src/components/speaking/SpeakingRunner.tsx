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
}

function targetTotalMinutes(parts: SpeakingPart[]) {
  return parts.reduce((a, p) => a + p.targetMinutes, 0);
}

export function SpeakingRunner({ attemptId, level }: Props) {
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
      window.location.href = `${base}/speaking/result/${attemptId}`;
    }
  }, [attemptId, level]);

  const handleMessage = useCallback(
    async (msg: StreamMessage) => {
      if (endedRef.current) return;
      bufRef.current.captureStreamMessage(msg);
      if (msg.type !== "chat" || !msg.fin) return;
      if (msg.pld.from !== "user" || !msg.pld.text) return;

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

        if (json.flags.advancePart != null) setCurrentPart(json.flags.advancePart);

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
    },
    [attemptId, submit],
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

        if (init.test.initialGreeting) await session.sendChat(init.test.initialGreeting);
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
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-500">{error}</p>
        <a
          className="mt-4 inline-block underline"
          href={`/${level.toLowerCase()}/speaking/new`}
        >
          返回
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 p-4 md:p-6">
      <div className="flex w-full items-center justify-between gap-2">
        {testCtx && (
          <PartProgressBar totalParts={testCtx.parts.length} currentPart={currentPart} />
        )}
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <EndTestButton onConfirm={submit} disabled={status === "ended"} />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        <div className="flex justify-center">
          <MinaAvatarPanel remoteUserId={remoteUserId} />
        </div>
        <div className="flex justify-center">
          <PhotoPanel photoUrl={photoUrl ?? null} caption={currentPartObj?.title} />
        </div>
      </div>
    </div>
  );
}
