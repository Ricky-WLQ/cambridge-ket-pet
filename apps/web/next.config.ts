import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Keep native-binary / websocket / AWS SDK packages out of the Turbopack
  // bundle so their internal filesystem paths (e.g. ffmpeg-static's exported
  // absolute path to ffmpeg.exe) resolve at runtime instead of being rewritten
  // to Turbopack's virtual \ROOT\ prefix.
  // trtc-sdk-v5 is intentionally NOT in this list — it's a browser-only
  // package that crashes on server import (touches `location` at module
  // load time). Components that use it are loaded via next/dynamic with
  // ssr:false, so they never reach the server runtime in the first place.
  serverExternalPackages: ["ffmpeg-static", "node-edge-tts", "@aws-sdk/client-s3"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "..", ".."),
  },
  // Next.js 16 requires query strings on local <Image src> to be allowlisted.
  // Mascot.tsx uses `?v=N` cache-busters when assets are regenerated; if the
  // ASSET_VERSION constant in Mascot.tsx is bumped, bump `search` here too.
  images: {
    localPatterns: [
      { pathname: "/mascots/**", search: "?v=4" },
    ],
  },
};

export default nextConfig;
