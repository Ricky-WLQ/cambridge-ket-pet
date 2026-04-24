"use client";

interface Props {
  photoUrl: string | null;
  caption?: string;
}

export function PhotoPanel({ photoUrl, caption }: Props) {
  if (!photoUrl) return null;
  return (
    <div className="w-full max-w-[480px] animate-fade-in rounded-xl border border-neutral-800 bg-neutral-950 p-2 shadow">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt={caption ?? "discussion photo"}
        className="w-full rounded-lg object-cover"
        loading="eager"
      />
      {caption && (
        <p className="mt-2 text-center text-sm text-neutral-400">{caption}</p>
      )}
    </div>
  );
}
