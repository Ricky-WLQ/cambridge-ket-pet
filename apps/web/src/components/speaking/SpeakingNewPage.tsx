"use client";

import { useState } from "react";
import Link from "next/link";

import { Mascot } from "@/components/Mascot";
import { MicPermissionGate } from "./MicPermissionGate";
import { ConnectionTest } from "./ConnectionTest";

interface Props {
  level: "KET" | "PET";
}

export function SpeakingNewPage({ level }: Props) {
  const [micOk, setMicOk] = useState(false);
  const [netOk, setNetOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/speaking/tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("今天已达到生成次数限制,请明天再试。");
        } else {
          setError(`生成测试失败:HTTP ${res.status}`);
        }
        return;
      }
      const json = (await res.json()) as { attemptId: string };
      const base = level === "KET" ? "/ket" : "/pet";
      window.location.href = `${base}/speaking/runner/${json.attemptId}`;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const portal = level === "KET" ? "ket" : "pet";
  return (
    <div className="mx-auto max-w-xl w-full space-y-4">
      <div className="px-1">
        <Link
          href={`/${portal}`}
          className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
        >
          ← 返回 {level} 门户
        </Link>
      </div>
      <div className="flex items-center gap-3 px-1">
        <Mascot pose="microphone" portal={portal} width={64} height={64} decorative />
        <div className="flex-1">
          <h1 className="text-lg font-extrabold leading-tight">
            {level} 口语测试
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            AI 考官 Mina 全程对话 · 请佩戴耳机并允许麦克风
          </p>
        </div>
      </div>

      <MicPermissionGate onReady={() => setMicOk(true)} />
      <ConnectionTest onResult={setNetOk} />

      {error && (
        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 font-bold">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!micOk || !netOk || loading}
        onClick={startTest}
        className="w-full rounded-full bg-emerald-600 px-4 py-3 text-white font-extrabold hover:bg-emerald-500 disabled:opacity-40 transition"
      >
        {loading ? "正在准备…" : "开始测试"}
      </button>

      <p className="text-xs text-ink/55 leading-relaxed">
        注意:为保护隐私,请勿在回答中提及具体姓名、学校、家庭住址等敏感信息。
      </p>
    </div>
  );
}
