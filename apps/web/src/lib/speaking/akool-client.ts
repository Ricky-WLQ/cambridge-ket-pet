/**
 * Server-only Akool streaming-avatar client.
 * Wraps /getToken (with in-memory cache), session/create, session/close.
 * All functions here read AKOOL_CLIENT_ID / AKOOL_CLIENT_SECRET and
 * must NEVER be imported from a Client Component.
 *
 * API version skew note: Akool mixes /v3 auth (getToken) with /v4
 * liveAvatar endpoints (session/create, session/close). Both are current
 * per Akool's published docs at time of writing.
 */

import "server-only";

// Defence in depth: `server-only` is the real barrier at Next.js build
// time, but vitest aliases it to an empty shim (see vitest.config.ts).
// If this module is ever loaded in a browser-like environment (jsdom,
// happy-dom, or — worst case — a misconfigured bundler), fail loud.
if (typeof window !== "undefined") {
  throw new Error(
    "akool-client must only be imported from server code; found `window` in scope",
  );
}

const AKOOL_BASE = "https://openapi.akool.com";
const GET_TOKEN_URL = `${AKOOL_BASE}/api/open/v3/getToken`;
const SESSION_CREATE_URL = `${AKOOL_BASE}/api/open/v4/liveAvatar/session/create`;
const SESSION_CLOSE_URL = `${AKOOL_BASE}/api/open/v4/liveAvatar/session/close`;

// --- Token cache ---------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cachedToken: CachedToken | null = null;

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name}`);
  return v;
}

function decodeJwtExpiryMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // Cross-runtime base64url decode: works under Node AND the Next.js
    // edge runtime (where Buffer is not available). Converts base64url
    // to standard base64 (- → +, _ → /) and pads to a multiple of 4.
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const payload = JSON.parse(atob(b64));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Reset the in-memory token cache. Intended for tests only.
 */
export function __resetAkoolTokenCache(): void {
  cachedToken = null;
}

export async function getAkoolToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - 60_000 > now) {
    return cachedToken.token;
  }

  const res = await fetch(GET_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: readEnv("AKOOL_CLIENT_ID"),
      clientSecret: readEnv("AKOOL_CLIENT_SECRET"),
    }),
    cache: "no-store",
  });

  let json: { code?: number; token?: string; msg?: string };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Akool token fetch: non-JSON response (HTTP ${res.status})`);
  }
  if (json.code !== 1000 || !json.token) {
    throw new Error(`Akool token fetch failed: code=${json.code} msg=${json.msg}`);
  }

  const expMs = decodeJwtExpiryMs(json.token) ?? now + 55 * 60 * 1000;
  cachedToken = { token: json.token, expiresAtMs: expMs };
  return json.token;
}

// --- Session create ------------------------------------------------------

// `livekit` dropped — only trtc + agora have credential-mapping branches
// below; adding livekit would need matching `credentials.livekit_*` handling
// in createAkoolSession. Re-add when a caller actually needs it.
export type AkoolStreamType = "trtc" | "agora";

export interface AkoolCreateSessionInput {
  avatarId: string;
  voiceId: string | null;
  durationSeconds: number;
  vadThreshold: number;
  vadSilenceMs: number;
  streamType?: AkoolStreamType;
}

export interface AkoolTrtcCredentials {
  sdkAppId: number;
  roomId: string;
  userId: string;
  userSig: string;
}

export interface AkoolAgoraCredentials {
  appId: string;
  channel: string;
  uid: number;
  token: string;
}

export interface AkoolCreateSessionResult {
  akoolSessionId: string;
  streamType: AkoolStreamType;
  trtc?: AkoolTrtcCredentials;
  agora?: AkoolAgoraCredentials;
}

export async function createAkoolSession(
  input: AkoolCreateSessionInput,
): Promise<AkoolCreateSessionResult> {
  const streamType: AkoolStreamType =
    input.streamType ?? ((process.env.AKOOL_STREAM_TYPE as AkoolStreamType | undefined) ?? "trtc");

  const token = await getAkoolToken();

  // voice_params: we omit `stt_type: "openai_realtime"` because that puts
  // Akool behind OpenAI's Realtime API (a full-duplex conversational
  // pipeline that vocalises responses on its own, fighting Retelling
  // mode). We KEEP `turn_detection`, though — Akool's default VAD is too
  // aggressive (it ends an utterance after ~300ms of silence), which made
  // candidate sentences arrive as fragmented STT events ("favorite
  // subject is" + "It's math." instead of one full sentence). The
  // `silence_duration_ms` here is the load-bearing knob: a Cambridge-test
  // candidate often pauses mid-sentence to think, and we need to keep the
  // utterance open through those pauses rather than dispatching half a
  // sentence to the examiner agent.
  const body: Record<string, unknown> = {
    avatar_id: input.avatarId,
    duration: input.durationSeconds,
    language: "en",
    mode_type: 1, // Retelling: the avatar only speaks what we push.
    stream_type: streamType,
    voice_params: {
      stt_language: "en",
      turn_detection: {
        type: "server_vad",
        threshold: input.vadThreshold,
        silence_duration_ms: input.vadSilenceMs,
      },
    },
  };
  if (input.voiceId) body.voice_id = input.voiceId;

  const res = await fetch(SESSION_CREATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  let json: {
    code?: number;
    msg?: string;
    data?: {
      _id?: string;
      stream_type?: string;
      credentials?: Record<string, unknown>;
    };
  };
  try {
    json = await res.json();
  } catch {
    throw new Error(`Akool session/create: non-JSON (HTTP ${res.status})`);
  }
  if (json.code !== 1000 || !json.data?._id) {
    throw new Error(
      `Akool session/create failed: code=${json.code} msg=${json.msg}`,
    );
  }

  const creds = json.data.credentials ?? {};
  const out: AkoolCreateSessionResult = {
    akoolSessionId: json.data._id,
    streamType,
  };

  if (streamType === "trtc") {
    out.trtc = {
      sdkAppId: Number(creds.trtc_app_id),
      roomId: String(creds.trtc_room_id ?? ""),
      userId: String(creds.trtc_user_id ?? ""),
      userSig: String(creds.trtc_user_sig ?? ""),
    };
  } else if (streamType === "agora") {
    out.agora = {
      appId: String(creds.agora_app_id ?? ""),
      channel: String(creds.agora_channel ?? ""),
      uid: Number(creds.agora_uid),
      token: String(creds.agora_token ?? ""),
    };
  }

  return out;
}

// --- Session close -------------------------------------------------------

export async function closeAkoolSession(akoolSessionId: string): Promise<void> {
  const token = await getAkoolToken();
  const res = await fetch(SESSION_CLOSE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: akoolSessionId }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Akool session/close HTTP ${res.status}`);
  }
  const json = await res.json().catch(() => ({}));
  if (json.code !== 1000) {
    // Log but don't throw — closing is best-effort; session will time out anyway.
    console.warn(
      `Akool session/close code=${json.code} msg=${json.msg} (ignored)`,
    );
  }
}
