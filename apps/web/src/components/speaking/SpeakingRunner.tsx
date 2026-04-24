"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

interface SpeakingTestContext {
  parts: Array<{
    partNumber: number;
    title: string;
    targetMinutes: number;
    photoKey: string | null;
  }>;
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

export function SpeakingRunner({ attemptId, level }: Props) {
  const [status, setStatus] = useState<SpeakingStatusLabel>("connecting");
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPart, setCurrentPart] = useState(1);
  const sessionRef = useRef<MinaTrtcSession | null>(null);
  const bufRef = useRef<ClientTranscriptBuffer>(createClientTranscriptBuffer());
  const currentPartRef = useRef(1);
  const testCtxRef = useRef<SpeakingTestContext | null>(null);
  const endedRef = useRef(false);

  // Sync currentPart → buffer
  useEffect(() => {
    currentPartRef.current = currentPart;
    bufRef.current.setCurrentPart(currentPart);
  }, [currentPart]);

  const submitAndNavigate = useCallback(async () => {
    try {
      await fetch(`/api/speaking/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientTranscript: bufRef.current.snapshot() }),
        keepalive: true,
      });
    } finally {
      await sessionRef.current?.close();
      const resultBase = level === "KET" ? "/ket" : "/pet";
      window.location.href = `${resultBase}/speaking/result/${attemptId}`;
    }
  }, [attemptId, level]);

  const handleMessage = useCallback(async (msg: StreamMessage) => {
    if (endedRef.current) return;
    bufRef.current.captureStreamMessage(msg);

    // Only trigger /reply on the end of a USER turn.
    if (msg.type !== "chat" || !msg.fin) return;
    if (msg.pld.from !== "user") return;
    if (!msg.pld.text) return;

    setStatus("thinking");

    // Build full history from the local buffer (user + bot turns).
    const history = bufRef.current.snapshot().map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch(`/api/speaking/${attemptId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, currentPart: currentPartRef.current }),
      });
      if (!res.ok) throw new Error(`/reply HTTP ${res.status}`);
      const json = await res.json() as {
        reply: string;
        flags: { advancePart: number | null; sessionEnd: boolean; retry?: boolean };
      };

      if (json.flags.advancePart != null) {
        setCurrentPart(json.flags.advancePart);
      }
      setStatus("speaking");
      await sessionRef.current?.sendChat(json.reply);

      if (json.flags.sessionEnd) {
        endedRef.current = true;
        setStatus("ended");
        // Small delay so Akool finishes TTS.
        setTimeout(() => void submitAndNavigate(), 1200);
      } else {
        // Listening resumes when Akool STT fires the next user turn.
        setStatus("listening");
      }
    } catch (err) {
      console.error("[runner] reply failed", err);
      setStatus("listening");
    }
  }, [attemptId, submitAndNavigate]);

  // Mount: create session → TRTC join → start listening
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/speaking/${attemptId}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) throw new Error(`/session HTTP ${res.status}`);
        const init = (await res.json()) as SessionInit;
        if (cancelled) return;
        testCtxRef.current = init.test;

        // NOTE: The plan's client-side warmup ping to `/api/speaking/warmup` has
        // been skipped. The actual examiner-warmup route requires
        // INTERNAL_SHARED_SECRET auth, so a browser fetch would 401. Warmup
        // should happen server-side before the route is hit — deferred to a
        // future optimisation.

        const session = await createMinaTrtcSession({
          credentials: init.trtc,
          onMessage: handleMessage,
          onRemoteVideoAvailable: (userId) => {
            setRemoteUserId(userId);
            // Bind the remote video track to #mina-video. The TRTC session's
            // `_client` is a private field not exposed in the public types;
            // the `as any` cast is necessary to reach the underlying SDK
            // client's subscribeRemoteVideo method.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = (session as any)._client ?? null;
            if (client?.subscribeRemoteVideo) {
              client.subscribeRemoteVideo({ userId, view: "mina-video", streamType: 0 });
            }
          },
          onDisconnected: () => {
            setError("连接已断开,请刷新重试。");
            setStatus("ended");
          },
        });
        sessionRef.current = session;
        setStatus("listening");

        // Send the initial greeting so Mina opens the conversation.
        if (init.test.initialGreeting) {
          await session.sendChat(init.test.initialGreeting);
        }
      } catch (err) {
        console.error("[runner] bootstrap failed", err);
        setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.close();
    };
  }, [attemptId, handleMessage]);

  if (error) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-500">{error}</p>
        <a className="mt-4 inline-block underline" href={`/${level.toLowerCase()}/speaking/new`}>返回</a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 p-6">
      <div className="flex w-full justify-end">
        <StatusPill status={status} />
      </div>
      <MinaAvatarPanel remoteUserId={remoteUserId} />
    </div>
  );
}
