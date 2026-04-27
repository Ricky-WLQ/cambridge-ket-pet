"use client";

/**
 * Client island for the diagnose hub's "generate this week's diagnose" CTA.
 *
 * Why a separate client component: the parent /diagnose hub page is a server
 * component (auth + Prisma fetch). Only the generate-button needs interactivity
 * (POST + loading state + router.refresh()), so we keep the client surface area
 * small.
 *
 * Behavior:
 *  1. Click → POST /api/diagnose/me/generate.
 *  2. Show inline error on 4xx/5xx with the API's error message.
 *  3. On success, router.refresh() so the server component re-fetches and
 *     renders the 6-section hub instead of the empty state.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { t } from "@/i18n/zh-CN";

export default function GenerateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = submitting || isPending;

  async function generate() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/diagnose/me/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "生成失败");
        setSubmitting(false);
        return;
      }
      // Generation succeeded — refresh the server-rendered page so the hub
      // shows the 6-section grid instead of the empty state.
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-2xl">
        ✨
      </div>
      <h2 className="mb-2 text-lg font-semibold text-neutral-900">
        {t.diagnose.emptyTitle}
      </h2>
      <p className="mb-6 text-sm text-neutral-600">{t.diagnose.emptyHint}</p>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t.diagnose.generating : t.diagnose.generateBtn}
      </button>
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
