import { describe, it, expect, vi, beforeEach } from "vitest";

const trtcMock = {
  enterRoom: vi.fn(async () => {}),
  exitRoom: vi.fn(async () => {}),
  startLocalAudio: vi.fn(async () => {}),
  stopLocalAudio: vi.fn(async () => {}),
  sendCustomMessage: vi.fn(() => true),
  on: vi.fn(),
  off: vi.fn(),
  subscribeRemoteVideo: vi.fn(async () => {}),
};
vi.mock("trtc-sdk-v5", () => ({
  default: { create: vi.fn(() => trtcMock), EVENT: {
    REMOTE_AUDIO_AVAILABLE: "remote-audio-available",
    REMOTE_VIDEO_AVAILABLE: "remote-video-available",
    CUSTOM_MESSAGE: "custom-message",
    KICKED_OUT: "kicked-out",
    CONNECTION_STATE_CHANGED: "connection-state-changed",
  } },
}));

import { createMinaTrtcSession, type StreamMessage } from "../trtc-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("trtc-client", () => {
  it("joins room, publishes mic, exposes send() and onMessage()", async () => {
    const receivedMessages: StreamMessage[] = [];
    const session = await createMinaTrtcSession({
      credentials: {
        sdkAppId: 111, roomId: "room-1", userId: "user-1", userSig: "sig-1",
      },
      onMessage: (m) => receivedMessages.push(m),
      onRemoteVideoAvailable: vi.fn(),
    });

    expect(trtcMock.enterRoom).toHaveBeenCalled();
    expect(trtcMock.startLocalAudio).toHaveBeenCalled();

    const onHandlerArgs = (trtcMock.on as any).mock.calls.find(
      (c: any[]) => c[0] === "custom-message",
    );
    expect(onHandlerArgs).toBeTruthy();
    onHandlerArgs[1]({ data: new TextEncoder().encode(JSON.stringify({
      v: 2, type: "chat", pld: { from: "user", text: "hello" }, fin: true, idx: 0,
    })) });
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].pld.from).toBe("user");

    await session.sendChat("hello there");
    expect(trtcMock.sendCustomMessage).toHaveBeenCalled();
    const payload = (trtcMock.sendCustomMessage as any).mock.calls.at(-1)[0];
    const decoded = JSON.parse(new TextDecoder().decode(payload.data));
    expect(decoded.type).toBe("chat");
    expect(decoded.pld.text).toBe("hello there");

    await session.interrupt();
    const last = (trtcMock.sendCustomMessage as any).mock.calls.at(-1)[0];
    const lastDecoded = JSON.parse(new TextDecoder().decode(last.data));
    expect(lastDecoded.type).toBe("command");
    expect(lastDecoded.pld.cmd).toBe("interrupt");

    await session.close();
    expect(trtcMock.stopLocalAudio).toHaveBeenCalled();
    expect(trtcMock.exitRoom).toHaveBeenCalled();
  });
});
