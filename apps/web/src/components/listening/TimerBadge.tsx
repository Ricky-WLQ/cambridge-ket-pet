"use client";

import { useEffect, useRef, useState } from "react";

export interface TimerBadgeProps {
  attemptId: string;
  syncInterval?: number; // ms, default 10000
  onAutoSubmit: () => void;
  phase: "LISTENING" | "REVIEW";
}

export function TimerBadge(props: TimerBadgeProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onAutoSubmitRef = useRef(props.onAutoSubmit);
  onAutoSubmitRef.current = props.onAutoSubmit;
  const autoSubmittedRef = useRef(false);

  // Server-sync poll
  useEffect(() => {
    let cancelled = false;
    const syncInterval = props.syncInterval ?? 10_000;

    const syncOnce = async () => {
      try {
        const res = await fetch(`/api/tests/attempts/${props.attemptId}/status`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.remainingSeconds === "number") {
          setRemaining(data.remainingSeconds);
        }
      } catch {
        // network blip — continue with local countdown
      }
    };

    syncOnce();
    const t = setInterval(syncOnce, syncInterval);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [props.attemptId, props.syncInterval]);

  // Local countdown every 1s
  useEffect(() => {
    if (remaining === null) return;
    const t = setInterval(() => {
      setRemaining((r) => (r === null ? null : Math.max(0, r - 1)));
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === null]);

  // Auto-submit when reaches 0
  useEffect(() => {
    if (remaining === 0 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      onAutoSubmitRef.current();
    }
  }, [remaining]);

  if (remaining === null) return <div className="text-xs text-slate-500">...</div>;

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const color =
    remaining < 60
      ? "text-red-600"
      : props.phase === "REVIEW"
        ? "text-amber-600"
        : "text-slate-800";

  return (
    <div className={`font-mono text-lg ${color}`}>
      {mm.toString().padStart(2, "0")}:{ss.toString().padStart(2, "0")}
    </div>
  );
}
