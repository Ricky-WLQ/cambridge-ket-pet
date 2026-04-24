/**
 * Server-only Akool streaming-avatar client.
 * Wraps /getToken (with in-memory cache), session/create, session/close.
 * All functions here read AKOOL_CLIENT_ID / AKOOL_CLIENT_SECRET and
 * must NEVER be imported from a Client Component.
 */

import "server-only";

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
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
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

export type AkoolStreamType = "trtc" | "agora" | "livekit";

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

  const body: Record<string, unknown> = {
    avatar_id: input.avatarId,
    duration: input.durationSeconds,
    language: "en",
    mode_type: 1, // Retelling: the avatar only speaks what we push.
    stream_type: streamType,
    voice_params: {
      stt_language: "en",
      stt_type: "openai_realtime",
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
