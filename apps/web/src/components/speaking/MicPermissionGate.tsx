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
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4">
      <p className="text-sm text-neutral-200">允许麦克风权限后方可开始测试。</p>
      {state === "idle" && (
        <button
          type="button"
          onClick={request}
          className="mt-3 rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-500"
        >
          允许麦克风
        </button>
      )}
      {state === "testing" && <p className="mt-3 text-sm text-neutral-400">请求权限中…</p>}
      {state === "granted" && <p className="mt-3 text-sm text-emerald-400">✓ 麦克风已就绪</p>}
      {state === "denied" && (
        <p className="mt-3 text-sm text-red-500">
          麦克风权限被拒绝。请在浏览器地址栏的锁图标中手动允许,然后刷新本页。
          {error && <span className="block text-xs text-neutral-400">({error})</span>}
        </p>
      )}
    </div>
  );
}
