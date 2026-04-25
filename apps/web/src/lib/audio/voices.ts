import type { VoiceTag } from "./types";

/**
 * Cambridge KET/PET listening 4-voice cast.
 *
 * All four voices are verified available on the Microsoft Bing
 * TTS endpoint callable through `node-edge-tts` (per research
 * 2026-04-23). Swap these constants to change accent later.
 */
export const VOICE_CAST = {
  proctor: "en-GB-ThomasNeural",
  S1_male: "en-GB-RyanNeural",
  S2_female_A: "en-GB-SoniaNeural",
  S2_female_B: "en-GB-LibbyNeural",
} as const satisfies Record<VoiceTag, string>;

export const ALL_VOICE_TAGS: VoiceTag[] = [
  "proctor",
  "S1_male",
  "S2_female_A",
  "S2_female_B",
];

export function voiceNameFor(tag: VoiceTag): string {
  return VOICE_CAST[tag];
}
