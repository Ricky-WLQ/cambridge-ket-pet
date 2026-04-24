"use client";

import TRTC from "trtc-sdk-v5";

export interface MinaTrtcCredentials {
  sdkAppId: number;
  roomId: string;
  userId: string;
  userSig: string;
}

export interface StreamMessage {
  v: number;
  type: "chat" | "command";
  mid?: string;
  idx?: number;
  fin?: boolean;
  pld: {
    from?: "user" | "bot";
    text?: string;
    cmd?: string;
    code?: number;
    msg?: string;
  };
}

export interface MinaTrtcSession {
  sendChat(text: string): Promise<void>;
  interrupt(): Promise<void>;
  close(): Promise<void>;
}

export async function createMinaTrtcSession(args: {
  credentials: MinaTrtcCredentials;
  onMessage: (m: StreamMessage) => void;
  onRemoteVideoAvailable?: (userId: string) => void;
  onRemoteAudioAvailable?: (userId: string) => void;
  onDisconnected?: () => void;
}): Promise<MinaTrtcSession> {
  const client = TRTC.create();

  client.on(TRTC.EVENT.CUSTOM_MESSAGE, (event: { data: Uint8Array | ArrayBuffer }) => {
    try {
      const buf = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : (event.data as Uint8Array);
      const text = new TextDecoder().decode(buf);
      const msg = JSON.parse(text) as StreamMessage;
      args.onMessage(msg);
    } catch (err) {
      console.warn("[trtc] failed to parse custom message", err);
    }
  });

  // Akool's avatar publishes its video + audio tracks the instant it joins
  // the room — sometimes BEFORE this createMinaTrtcSession() function returns.
  // Auto-subscribe both inside the SDK-event handler (where `client` is a
  // closure-captured local) so the consumer doesn't have to chase the client
  // through the not-yet-assigned `session` const.
  //
  // TRTC v5's method to render a remote stream is `startRemoteVideo` (NOT
  // `subscribeRemoteVideo` — that's a name from earlier SDK generations).
  // Also: `autoReceiveVideo` defaults to false, so without an explicit
  // startRemoteVideo() call the SDK won't even DECODE the remote track,
  // and the avatar div stays black.
  client.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (e: { userId: string }) => {
    client
      .startRemoteVideo({
        userId: e.userId,
        streamType: TRTC.TYPE.STREAM_TYPE_MAIN,
        view: "mina-video",
      })
      .catch((err: unknown) =>
        console.warn("[trtc] startRemoteVideo failed", err),
      );
    if (args.onRemoteVideoAvailable) {
      try {
        args.onRemoteVideoAvailable(e.userId);
      } catch (err) {
        console.warn("[trtc] onRemoteVideoAvailable handler threw", err);
      }
    }
  });
  client.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, (e: { userId: string }) => {
    // Defensive unmute. TRTC v5 default is auto-play remote audio, but
    // browser autoplay policy can silently mute it; muteRemoteAudio(false)
    // is idempotent and ensures Mina's voice plays.
    client
      .muteRemoteAudio(e.userId, false)
      .catch((err: unknown) =>
        console.warn("[trtc] muteRemoteAudio(false) failed", err),
      );
    if (args.onRemoteAudioAvailable) {
      try {
        args.onRemoteAudioAvailable(e.userId);
      } catch (err) {
        console.warn("[trtc] onRemoteAudioAvailable handler threw", err);
      }
    }
  });
  if (args.onDisconnected) {
    // TRTC v5.17 surfaces unexpected disconnects via CONNECTION_STATE_CHANGED
    // (event string "connection-state-changed"). Fire onDisconnected only on
    // CONNECTED → DISCONNECTED transitions so reconnect attempts (DISCONNECTED →
    // CONNECTING) don't spam the callback. The KICKED_OUT event is separate
    // and always indicates a hard disconnect.
    client.on(
      TRTC.EVENT.CONNECTION_STATE_CHANGED,
      (event: { state: string; prevState: string }) => {
        if (event.state === "DISCONNECTED" && event.prevState === "CONNECTED") {
          args.onDisconnected!();
        }
      },
    );
    client.on(TRTC.EVENT.KICKED_OUT, args.onDisconnected);
  }

  await client.enterRoom({
    sdkAppId: args.credentials.sdkAppId,
    userId: args.credentials.userId,
    userSig: args.credentials.userSig,
    strRoomId: args.credentials.roomId,
    role: "anchor",
  } as any);

  await client.startLocalAudio();

  let sentCount = 0;

  async function sendRaw(msg: StreamMessage): Promise<void> {
    const encoded = new TextEncoder().encode(JSON.stringify(msg));
    // TRTC v5 sendCustomMessage requires { cmdId: number 1..10, data: ArrayBuffer }.
    // cmdId=1 is fine — Akool reads the JSON body, not the cmdId channel.
    // Convert the Uint8Array view to its underlying ArrayBuffer with a slice
    // so we don't accidentally forward over-allocated bytes.
    const buffer = encoded.buffer.slice(
      encoded.byteOffset,
      encoded.byteOffset + encoded.byteLength,
    ) as ArrayBuffer;
    await client.sendCustomMessage({ cmdId: 1, data: buffer });
  }

  // Defensive runtime pin: in addition to mode_type:1 at session/create time,
  // re-assert mode=1 (Retelling) via the runtime set-params command. Reports
  // from the field have shown the create-time mode_type does not always
  // stick on Akool's side, leaving the avatar in Dialogue mode where it
  // runs its own LLM and echoes / freelances. Sending set-params after
  // enterRoom guarantees the avatar will only TTS what we push via
  // sendChat() and won't auto-respond to user STT.
  await sendRaw({
    v: 2,
    type: "command",
    mid: `cmd-${Date.now()}-pin-mode`,
    pld: {
      cmd: "set-params",
      data: { mode: 1, lang: "en" },
    } as StreamMessage["pld"],
  });

  return {
    async sendChat(text: string) {
      sentCount += 1;
      await sendRaw({
        v: 2,
        type: "chat",
        mid: `msg-${Date.now()}-${sentCount}`,
        idx: 0,
        fin: true,
        pld: { text },
      });
    },
    async interrupt() {
      await sendRaw({
        v: 2,
        type: "command",
        mid: `cmd-${Date.now()}`,
        pld: { cmd: "interrupt" },
      });
    },
    async close() {
      try {
        await client.stopLocalAudio();
      } catch {
        /* ignore */
      }
      try {
        await client.exitRoom();
      } catch {
        /* ignore */
      }
    },
  };
}
