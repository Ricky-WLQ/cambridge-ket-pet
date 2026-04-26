/**
 * Quick smoke-test for whether node-edge-tts can actually synthesize from
 * this network. Helps distinguish "DNS-blackholed" vs "endpoint slow" vs
 * "library timeout" failure modes.
 */
import "dotenv/config";
import { EdgeTTS } from "node-edge-tts";
import path from "path";
import os from "os";

async function main() {
  const out = path.join(os.tmpdir(), `probe-edge-tts-${Date.now()}.mp3`);
  console.log("Output:", out);
  const tts = new EdgeTTS({
    voice: "en-GB-RyanNeural",
    lang: "en-GB",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate: "+0%",
    pitch: "default",
    volume: "default",
  });

  console.log("Calling ttsPromise…");
  const start = Date.now();
  try {
    await tts.ttsPromise(
      "Hello, this is a one-sentence smoke test for Edge TTS.",
      out,
    );
    console.log(`OK in ${Date.now() - start}ms`);
  } catch (e: unknown) {
    console.error(`FAIL in ${Date.now() - start}ms:`);
    if (e instanceof Error) {
      console.error("  name:", e.name);
      console.error("  message:", e.message);
      console.error("  stack:", e.stack?.split("\n").slice(0, 6).join("\n"));
    } else {
      console.error(e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
