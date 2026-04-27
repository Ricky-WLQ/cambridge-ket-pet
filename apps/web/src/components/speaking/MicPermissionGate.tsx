"use client";

import { useState } from "react";

export function MicPermissionGate({
  onReady,
}: {
  onReady: (stream: MediaStream) => void;
}) {
  const [state, setState] = useState<"idle" | "granted" | "denied" | "testing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function request() {
    setState("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setState("granted");
      onReady(stream);
    } catch (err) {
      setState("denied");
      setError((err as Error).message);
    }
  }

  return (
    <div className="rounded-2xl tile-mint border-2 border-ink/10 p-4 stitched-card">
      <p className="text-sm font-bold text-ink">允许麦克风权限后方可开始测试。</p>
      {state === "idle" && (
        <button
          type="button"
          onClick={request}
          className="mt-3 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-extrabold text-white hover:bg-emerald-500 transition"
        >
          允许麦克风
        </button>
      )}
      {state === "testing" && <p className="mt-3 text-sm text-ink/65 font-bold">请求权限中…</p>}
      {state === "granted" && <p className="mt-3 text-sm text-emerald-700 font-extrabold">✓ 麦克风已就绪</p>}
      {state === "denied" && (
        <p className="mt-3 text-sm text-rose-700 font-bold">
          麦克风权限被拒绝。请在浏览器地址栏的锁图标中手动允许,然后刷新本页。
          {error && <span className="block text-xs text-ink/55 font-medium">({error})</span>}
        </p>
      )}
    </div>
  );
}
