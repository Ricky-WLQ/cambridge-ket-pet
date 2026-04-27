"use client";

import { useEffect, useRef, useState } from "react";
import type { AudioSegmentRecord } from "@/lib/audio/types";

export interface AudioPlayerProps {
  src: string;
  segments: AudioSegmentRecord[];
  controls: {
    playPause: boolean;
    scrub: boolean;
    skip10: boolean;
    speed: boolean;
    perSegmentReplay: boolean;
  };
  onEnded?: () => void;
  onSegmentChange?: (segmentId: string | null) => void;
  autoPlay?: boolean;
  initiallyMuted?: boolean;
}

export function AudioPlayer(props: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Report current segment based on timestamps
  useEffect(() => {
    if (!props.onSegmentChange) return;
    const currentMs = currentTime * 1000;
    const seg = props.segments.find(
      (s) => currentMs >= s.startMs && currentMs < s.endMs
    );
    props.onSegmentChange(seg?.id ?? null);
  }, [currentTime, props]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const skip = (deltaSec: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(a.duration, a.currentTime + deltaSec));
  };

  const jumpToSegment = (segmentId: string) => {
    const seg = props.segments.find((s) => s.id === segmentId);
    const a = audioRef.current;
    if (seg && a) {
      a.currentTime = seg.startMs / 1000;
      a.play();
    }
  };

  const setPlaybackSpeed = (r: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = r;
    setSpeed(r);
  };

  return (
    <div className="rounded-2xl bg-white border-2 border-ink/10 p-3 stitched-card">
      <audio
        ref={audioRef}
        src={props.src}
        autoPlay={props.autoPlay}
        muted={props.initiallyMuted}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { setIsPlaying(false); props.onEnded?.(); }}
      />

      <div className="flex items-center gap-3 p-3 bg-mist rounded-xl">
        {props.controls.skip10 && (
          <button
            className="rounded-full border-2 border-ink/15 px-3 py-1.5 text-sm font-bold bg-white hover:bg-ink/5 transition"
            onClick={() => skip(-10)}
            aria-label="-10s"
          >
            ⏪ 10s
          </button>
        )}
        {props.controls.playPause && (
          <button
            className="rounded-full bg-ink text-white text-base font-extrabold px-5 py-2 hover:bg-ink/90 transition"
            onClick={togglePlay}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
        {props.controls.skip10 && (
          <button
            className="rounded-full border-2 border-ink/15 px-3 py-1.5 text-sm font-bold bg-white hover:bg-ink/5 transition"
            onClick={() => skip(10)}
            aria-label="+10s"
          >
            10s ⏩
          </button>
        )}

        <div className="flex-1 mx-3">
          {props.controls.scrub ? (
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => {
                const a = audioRef.current;
                if (a) a.currentTime = Number(e.target.value);
              }}
              className="w-full"
            />
          ) : (
            <div className="h-2 w-full rounded-full bg-mist border-2 border-ink/10 overflow-hidden">
              <div
                className="h-full bg-ink"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          )}
          <div className="text-xs text-ink/60 mt-1 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {props.controls.speed && (
          <div className="flex gap-1">
            {[0.75, 1, 1.25].map((r) => (
              <button
                key={r}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  speed === r
                    ? "bg-ink text-white"
                    : "border-2 border-ink/15 bg-white hover:bg-ink/5"
                }`}
                onClick={() => setPlaybackSpeed(r)}
              >
                {r}×
              </button>
            ))}
          </div>
        )}
      </div>

      {props.controls.perSegmentReplay && (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.segments
            .filter((s) => s.kind === "question_stimulus" && s.questionId)
            .filter((s, i, arr) => arr.findIndex((x) => x.questionId === s.questionId) === i)
            .map((s) => (
              <button
                key={s.id}
                className="rounded-full border-2 border-ink/15 px-4 py-1.5 text-sm font-bold bg-white hover:bg-ink/5 transition"
                onClick={() => jumpToSegment(s.id)}
              >
                重播 {s.questionId}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}
