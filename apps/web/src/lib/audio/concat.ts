import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

function resolveFfmpeg(): string {
  const override = process.env.FFMPEG_BINARY;
  if (override && override !== "auto") return override;
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
  return ffmpegPath;
}

function resolveFfprobe(): string {
  // ffmpeg-static ships ffmpeg only; for ffprobe we call ffmpeg with -show_entries via stream
  // For simplicity here, use ffmpeg -i parse — but the cleaner path is @ffprobe-installer/ffprobe.
  // We'll use ffmpeg's `-hide_banner -i <f> -f null -` and parse stderr for duration, OR use ffprobe if installed.
  return resolveFfmpeg();
}

/**
 * Probe an audio file's duration in ms via ffprobe-style parsing.
 * Uses `ffmpeg -i <file> -f null -` and parses "Duration: HH:MM:SS.xx" from stderr.
 */
export function probeDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      resolveFfprobe(),
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
      (err, stdout, stderr) => {
        if (err) {
          // Fallback: parse from ffmpeg -i stderr
          const m = /Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(String(stderr ?? ""));
          if (m) {
            const hours = parseInt(m[1], 10);
            const mins = parseInt(m[2], 10);
            const secs = parseFloat(m[3]);
            resolve(Math.round((hours * 3600 + mins * 60 + secs) * 1000));
            return;
          }
          reject(err);
          return;
        }
        const secs = parseFloat(String(stdout).trim());
        if (Number.isNaN(secs)) {
          reject(new Error(`Could not parse duration from ffprobe output: ${stdout}`));
          return;
        }
        resolve(Math.round(secs * 1000));
      },
    );
  });
}

/**
 * Generate a silent mp3 of the requested duration and save to `outPath`.
 */
export function generateSilenceMp3(durationSec: number, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      resolveFfmpeg(),
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `anullsrc=r=24000:cl=mono`,
        "-t",
        String(durationSec),
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        outPath,
      ],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

/**
 * Concatenate a list of mp3 files into a single mp3 using ffmpeg's
 * concat demuxer.
 */
export function concatMp3s(inputPaths: string[], outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listPath = path.join(path.dirname(outPath), `concat-${Date.now()}.txt`);
    const manifest = inputPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, manifest, "utf-8");

    execFile(
      resolveFfmpeg(),
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      (err) => {
        try {
          fs.rmSync(listPath, { force: true });
        } catch {
          /* ignore cleanup */
        }
        if (err) reject(err);
        else resolve();
      },
    );
  });
}
