import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep native-binary / websocket / AWS SDK packages out of the Turbopack
  // bundle so their internal filesystem paths (e.g. ffmpeg-static's exported
  // absolute path to ffmpeg.exe) resolve at runtime instead of being rewritten
  // to Turbopack's virtual \ROOT\ prefix.
  serverExternalPackages: ["ffmpeg-static", "node-edge-tts", "@aws-sdk/client-s3", "trtc-sdk-v5"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "..", ".."),
  },
};

export default nextConfig;
