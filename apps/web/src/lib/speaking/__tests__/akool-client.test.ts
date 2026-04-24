import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAkoolSession,
  closeAkoolSession,
  getAkoolToken,
  __resetAkoolTokenCache,
  type AkoolCreateSessionInput,
} from "../akool-client";

const envBackup = { ...process.env };

function setEnv(overrides: Record<string, string>) {
  process.env = {
    ...envBackup,
    AKOOL_CLIENT_ID: "cid",
    AKOOL_CLIENT_SECRET: "csecret",
    AKOOL_STREAM_TYPE: "trtc",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

beforeEach(() => {
  setEnv({});
  __resetAkoolTokenCache();
  vi.restoreAllMocks();
});
afterEach(() => {
  process.env = envBackup;
});

const mockFetch = (responder: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    return responder(url, init);
  }));
};

describe("getAkoolToken", () => {
  it("returns and caches the token across calls", async () => {
    let calls = 0;
    mockFetch((url) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        calls++;
        // 10-minute expiry relative to now
        const exp = Math.floor(Date.now() / 1000) + 600;
        // JWT-shape header.payload.sig with payload containing exp
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const t1 = await getAkoolToken();
    const t2 = await getAkoolToken();
    expect(t1).toBe(t2);
    expect(calls).toBe(1);
  });

  it("throws on non-1000 codes", async () => {
    mockFetch(() =>
      new Response(JSON.stringify({ code: 1101, msg: "invalid" }), { status: 200 }),
    );
    await expect(getAkoolToken()).rejects.toThrow(/akool token.*1101/i);
  });
});

describe("createAkoolSession", () => {
  it("POSTs the expected body and returns TRTC credentials", async () => {
    let capturedBody: any = null;
    mockFetch((url, init) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      if (url.endsWith("/api/open/v4/liveAvatar/session/create")) {
        capturedBody = JSON.parse((init!.body as string));
        return new Response(JSON.stringify({
          code: 1000,
          msg: "OK",
          data: {
            _id: "sess-xyz",
            uid: 123,
            type: 2,
            status: 1,
            stream_type: "trtc",
            credentials: {
              trtc_app_id: 111,
              trtc_room_id: "room-1",
              trtc_user_id: "user-1",
              trtc_user_sig: "sig-1",
            },
          },
        }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const input: AkoolCreateSessionInput = {
      avatarId: "avatar-1",
      voiceId: "voice-1",
      durationSeconds: 900,
      vadThreshold: 0.6,
      vadSilenceMs: 500,
    };
    const out = await createAkoolSession(input);

    expect(out.akoolSessionId).toBe("sess-xyz");
    expect(out.streamType).toBe("trtc");
    expect(out.trtc).toEqual({
      sdkAppId: 111,
      roomId: "room-1",
      userId: "user-1",
      userSig: "sig-1",
    });

    // Request body sanity
    expect(capturedBody.avatar_id).toBe("avatar-1");
    expect(capturedBody.voice_id).toBe("voice-1");
    expect(capturedBody.mode_type).toBe(1);
    expect(capturedBody.stream_type).toBe("trtc");
    expect(capturedBody.language).toBe("en");
    expect(capturedBody.duration).toBe(900);
    expect(capturedBody.voice_params.turn_detection.type).toBe("server_vad");
    expect(capturedBody.voice_params.turn_detection.threshold).toBe(0.6);
    expect(capturedBody.voice_params.turn_detection.silence_duration_ms).toBe(500);
    expect(capturedBody.voice_params.stt_language).toBe("en");
  });

  it("throws on non-1000 responses", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 1008, msg: "avatar not found" }), { status: 200 });
    });
    await expect(
      createAkoolSession({ avatarId: "missing", voiceId: null, durationSeconds: 900, vadThreshold: 0.6, vadSilenceMs: 500 }),
    ).rejects.toThrow(/akool.*session\/create.*1008/i);
  });
});

describe("closeAkoolSession", () => {
  it("POSTs the session id", async () => {
    let closedId: string | null = null;
    mockFetch((url, init) => {
      if (url.endsWith("/api/open/v3/getToken")) {
        const exp = Math.floor(Date.now() / 1000) + 600;
        const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
        return new Response(JSON.stringify({ code: 1000, token: `h.${payload}.s` }), { status: 200 });
      }
      if (url.endsWith("/api/open/v4/liveAvatar/session/close")) {
        closedId = JSON.parse(init!.body as string).id;
        return new Response(JSON.stringify({ code: 1000, msg: "OK" }), { status: 200 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    await closeAkoolSession("sess-xyz");
    expect(closedId).toBe("sess-xyz");
  });
});
