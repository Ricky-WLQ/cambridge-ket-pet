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

  if (args.onRemoteVideoAvailable) {
    client.on(TRTC.EVENT.REMOTE_VIDEO_AVAILABLE, (e: { userId: string }) =>
      args.onRemoteVideoAvailable!(e.userId),
    );
  }
  if (args.onRemoteAudioAvailable) {
    client.on(TRTC.EVENT.REMOTE_AUDIO_AVAILABLE, (e: { userId: string }) =>
      args.onRemoteAudioAvailable!(e.userId),
    );
  }
  if (args.onDisconnected) {
    // TRTC v5 type declarations do not enumerate ROOM_DISCONNECTED on
    // TRTC.EVENT, but the runtime constant and event are emitted. Cast to any
    // to access the constant without wrestling the declaration files.
    client.on((TRTC.EVENT as any).ROOM_DISCONNECTED, args.onDisconnected);
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
    const data = new TextEncoder().encode(JSON.stringify(msg));
    // TRTC v5 type declarations require { cmdId, data: ArrayBuffer } but the
    // runtime accepts a Uint8Array view. Cast to any to match the plan's API
    // surface without fighting declaration files.
    await client.sendCustomMessage({ data } as any);
  }

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
