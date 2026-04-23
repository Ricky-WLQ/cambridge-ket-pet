"use client";

import { useState } from "react";
import type { AudioSegmentRecord, ListeningPart } from "@/lib/audio/types";

export interface TapescriptPanelProps {
  parts: ListeningPart[];
  segments: AudioSegmentRecord[];
  currentSegmentId: string | null;
  defaultOpen?: boolean;
  canToggle?: boolean;
}

export function TapescriptPanel(props: TapescriptPanelProps) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);

  if (!open && props.canToggle) {
    return (
      <button
        className="text-sm underline text-blue-700"
        onClick={() => setOpen(true)}
      >
        显示听力原文
      </button>
    );
  }

  return (
    <div className="tapescript-panel border rounded p-4 bg-white">
      {props.canToggle && (
        <button
          className="text-sm underline text-blue-700 mb-3"
          onClick={() => setOpen(false)}
        >
          隐藏听力原文
        </button>
      )}
      {props.parts.map((part) => (
        <div key={part.partNumber} className="mb-4">
          <h3 className="font-semibold">第 {part.partNumber} 部分</h3>
          {part.audioScript
            .filter((s) => s.text)
            .map((s) => {
              const isCurrent = s.id === props.currentSegmentId;
              return (
                <p
                  key={s.id}
                  className={
                    isCurrent
                      ? "font-bold bg-yellow-100 px-2 py-1 my-1 rounded"
                      : "text-slate-700 my-1"
                  }
                >
                  <span className="text-xs text-slate-500 mr-2">
                    [{s.voiceTag ?? "silence"}]
                  </span>
                  {s.text}
                </p>
              );
            })}
        </div>
      ))}
    </div>
  );
}
