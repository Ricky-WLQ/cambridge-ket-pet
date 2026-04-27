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
      <h1 className="text-3xl font-extrabold mb-6">
        {props.portal.toUpperCase()} · <span className="marker-yellow-thick">听力练习</span>
      </h1>

      <fieldset className="rounded-2xl bg-white border-2 border-ink/10 p-5 mb-4 stitched-card">
        <legend className="px-2 text-sm font-extrabold">模式</legend>
        <div className="flex flex-wrap gap-5 mt-1">
          {(["PRACTICE", "MOCK"] as const).map((m) => (
            <label key={m} className="inline-flex items-center gap-2 cursor-pointer text-base">
              <input
                type="radio"
                name="mode"
                checked={mode === m}
                onChange={() => setMode(m)}
              />{" "}
              <span className={mode === m ? "font-bold" : ""}>{m === "MOCK" ? "模考" : "练习"}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl bg-white border-2 border-ink/10 p-5 mb-4 stitched-card">
        <legend className="px-2 text-sm font-extrabold">范围</legend>
        <div className="flex flex-wrap gap-5 mt-1">
          <label className="inline-flex items-center gap-2 cursor-pointer text-base">
            <input
              type="radio"
              name="scope"
              checked={scope === "FULL"}
              onChange={() => setScope("FULL")}
            />{" "}
            <span className={scope === "FULL" ? "font-bold" : ""}>完整试卷</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-base">
            <input
              type="radio"
              name="scope"
              checked={scope === "PART"}
              onChange={() => setScope("PART")}
            />{" "}
            <span className={scope === "PART" ? "font-bold" : ""}>单个部分</span>
          </label>
        </div>
      </fieldset>

      {scope === "PART" && (
        <fieldset className="rounded-2xl bg-white border-2 border-ink/10 p-5 mb-6 stitched-card">
          <legend className="px-2 text-sm font-extrabold">部分</legend>
          <div className="flex flex-wrap gap-4 mt-1">
            {props.parts.map((p) => (
              <label key={p} className="inline-flex items-center gap-2 cursor-pointer text-base">
                <input
                  type="radio"
                  name="part"
                  checked={part === p}
                  onChange={() => setPart(p)}
                />{" "}
                <span className={part === p ? "font-bold" : ""}>第 {p} 部分</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        onClick={start}
        disabled={busy}
        className="rounded-full bg-ink text-white text-base font-extrabold px-7 py-3 hover:bg-ink/90 transition disabled:opacity-50"
      >
        {busy ? "生成中..." : "开始"}
      </button>

      {err && <p className="mt-4 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 font-bold">{err}</p>}
    </div>
  );
}
