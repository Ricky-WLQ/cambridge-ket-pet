"use client";

import { useRef } from "react";

interface Props {
  remoteUserId: string | null;
}

export function MinaAvatarPanel({ remoteUserId }: Props) {
  const viewRef = useRef<HTMLDivElement | null>(null);

  // The actual track-to-view binding happens in SpeakingRunner via
  // client.subscribeRemoteVideo({ userId, view }); this component
  // just provides the DOM mount point identified by id.
  return (
    <div
      ref={viewRef}
      id="mina-video"
      className="relative aspect-[9/16] w-full max-w-[480px] overflow-hidden rounded-2xl bg-neutral-950 md:aspect-[3/4]"
    >
      {!remoteUserId && (
        <div className="absolute inset-0 grid place-items-center text-neutral-500 text-sm">
          正在加载 Mina…
        </div>
      )}
    </div>
  );
}
