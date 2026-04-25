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
    <div className="audio-player">
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

      <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg">
        {props.controls.skip10 && (
          <button className="px-2 py-1 border rounded"
            onClick={() => skip(-10)} aria-label="-10s">⏪ 10s</button>
        )}
        {props.controls.playPause && (
          <button className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={togglePlay}>
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
        {props.controls.skip10 && (
          <button className="px-2 py-1 border rounded"
            onClick={() => skip(10)} aria-label="+10s">10s ⏩</button>
        )}

        <div className="flex-1 mx-3">
          {props.controls.scrub ? (
            <input type="range" min={0} max={duration || 0} step={0.1}
              value={currentTime}
              onChange={(e) => {
                const a = audioRef.current;
                if (a) a.currentTime = Number(e.target.value);
              }}
              className="w-full"
            />
          ) : (
            <div className="h-2 bg-slate-300 rounded">
              <div
                className="h-2 bg-blue-600 rounded"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
          )}
          <div className="text-xs text-slate-600 mt-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {props.controls.speed && (
          <div className="flex gap-1">
            {[0.75, 1, 1.25].map((r) => (
              <button
                key={r}
                className={`px-2 py-1 text-xs rounded border ${
                  speed === r ? "bg-blue-600 text-white" : ""
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
                className="px-3 py-1 border rounded text-sm hover:bg-slate-200"
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
