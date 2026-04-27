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
    <div className="w-full max-w-[480px] animate-fade-in rounded-2xl border-2 border-ink/10 bg-white p-2 stitched-card">
      {errored ? (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl tile-peach p-6 text-center text-sm font-bold text-ink/70">
          <span className="text-3xl">📷</span>
          <span>图片暂时无法加载</span>
          <span className="text-xs font-medium text-ink/55">
            Photo unavailable — describe what you imagine the topic looks like
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={caption ?? "discussion photo"}
          className="w-full rounded-xl object-cover"
          loading="eager"
          onError={() => setErrored(true)}
        />
      )}
      {caption && (
        <p className="mt-2 text-center text-sm font-bold text-ink/70">{caption}</p>
      )}
    </div>
  );
}
