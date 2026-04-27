"use client";

import { useState } from "react";

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

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <h1 className="text-3xl font-extrabold leading-tight">
          口语测试 — <span className="marker-yellow-thick">{level}</span>
        </h1>
        <p className="mt-2 text-base sm:text-lg text-ink/75 leading-relaxed">
          本次练习由 AI 考官 Mina 全程对话。请在安静环境下佩戴耳机,并允许麦克风权限。
        </p>
      </header>

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
