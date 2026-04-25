"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface NewListeningPickerProps {
  portal: "ket" | "pet";
  parts: number[];
}

export function NewListeningPicker(props: NewListeningPickerProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"MOCK" | "PRACTICE">("PRACTICE");
  const [scope, setScope] = useState<"FULL" | "PART">("PART");
  const [part, setPart] = useState<number>(props.parts[0] ?? 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/tests/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "LISTENING",
        examType: props.portal.toUpperCase(),
        mode,
        scope,
        part: scope === "PART" ? part : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.message ?? data.error ?? "生成失败");
      setBusy(false);
      return;
    }
    const { testId } = await res.json();

    // Create attempt
    const a = await fetch(`/api/listening/tests/${testId}/attempt`, { method: "POST" });
    if (!a.ok) {
      const data = await a.json().catch(() => ({}));
      setErr(data.message ?? data.error ?? "创建 attempt 失败");
      setBusy(false);
      return;
    }
    const { attemptId } = await a.json();
    router.push(`/${props.portal}/listening/runner/${attemptId}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        {props.portal.toUpperCase()} · 听力练习
      </h1>

      <fieldset className="mb-4">
        <legend className="font-semibold">模式</legend>
        {(["PRACTICE", "MOCK"] as const).map((m) => (
          <label key={m} className="mr-4">
            <input
              type="radio"
              name="mode"
              checked={mode === m}
              onChange={() => setMode(m)}
            />{" "}
            {m === "MOCK" ? "模考" : "练习"}
          </label>
        ))}
      </fieldset>

      <fieldset className="mb-4">
        <legend className="font-semibold">范围</legend>
        <label className="mr-4">
          <input
            type="radio"
            name="scope"
            checked={scope === "FULL"}
            onChange={() => setScope("FULL")}
          />{" "}
          完整试卷
        </label>
        <label>
          <input
            type="radio"
            name="scope"
            checked={scope === "PART"}
            onChange={() => setScope("PART")}
          />{" "}
          单个部分
        </label>
      </fieldset>

      {scope === "PART" && (
        <fieldset className="mb-4">
          <legend className="font-semibold">部分</legend>
          {props.parts.map((p) => (
            <label key={p} className="mr-4">
              <input
                type="radio"
                name="part"
                checked={part === p}
                onChange={() => setPart(p)}
              />{" "}
              第 {p} 部分
            </label>
          ))}
        </fieldset>
      )}

      <button
        onClick={start}
        disabled={busy}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {busy ? "生成中..." : "开始"}
      </button>

      {err && <p className="text-red-600 mt-4">{err}</p>}
    </div>
  );
}
