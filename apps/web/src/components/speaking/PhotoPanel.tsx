"use client";

import { useState } from "react";

interface Props {
  photoUrl: string | null;
  caption?: string;
}

export function PhotoPanel({ photoUrl, caption }: Props) {
  const [errored, setErrored] = useState(false);
  if (!photoUrl) return null;
  return (
    <div className="w-full max-w-[480px] animate-fade-in rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow">
      {errored ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg bg-neutral-900 p-6 text-center text-sm text-neutral-400">
          <span className="text-2xl">📷</span>
          <span>图片暂时无法加载</span>
          <span className="text-xs text-neutral-500">
            Photo unavailable — describe what you imagine the topic looks like
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={caption ?? "discussion photo"}
          className="w-full rounded-lg object-cover"
          loading="eager"
          onError={() => setErrored(true)}
        />
      )}
      {caption && (
        <p className="mt-2 text-center text-sm text-neutral-400">{caption}</p>
      )}
    </div>
  );
}
