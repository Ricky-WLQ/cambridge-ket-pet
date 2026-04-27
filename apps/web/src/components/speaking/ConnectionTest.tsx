"use client";

import { useEffect, useState } from "react";
import TRTC from "trtc-sdk-v5";

export function ConnectionTest({ onResult }: { onResult: (ok: boolean) => void }) {
  const [state, setState] = useState<"pending" | "ok" | "fail">("pending");

  useEffect(() => {
    (async () => {
      try {
        const res = await TRTC.isSupported();
        if (res?.result) {
          setState("ok");
          onResult(true);
        } else {
          setState("fail");
          onResult(false);
        }
      } catch {
        setState("fail");
        onResult(false);
      }
    })();
  }, [onResult]);

  return (
    <div className="rounded-2xl tile-sky border-2 border-ink/10 p-4 stitched-card text-sm">
      {state === "pending" && <p className="text-ink/65 font-bold">正在检查浏览器…</p>}
      {state === "ok" && <p className="text-emerald-700 font-extrabold">✓ 浏览器支持实时视频</p>}
      {state === "fail" && (
        <p className="text-rose-700 font-bold">
          当前浏览器不支持实时视频。请使用最新版 Chrome 或 Edge 桌面浏览器。
        </p>
      )}
    </div>
  );
}
