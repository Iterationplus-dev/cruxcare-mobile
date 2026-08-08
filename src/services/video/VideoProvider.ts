/**
 * Video/audio provider is an open item (README / PRD §17.1 — Agora, Twilio,
 * Daily or LiveKit unconfirmed). Code against this interface; the UI (mute,
 * camera toggle, recording consent, participant tiles) doesn't change when
 * a real SFU is wired in — only this implementation does.
 */
export interface VideoRoomHandle {
  roomId: string;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
}

export interface VideoProvider {
  join(roomId: string): Promise<VideoRoomHandle>;
}

export class MockVideoProvider implements VideoProvider {
  async join(roomId: string): Promise<VideoRoomHandle> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      roomId,
      leave: async () => {},
      setMuted: async () => {},
      setCameraEnabled: async () => {},
    };
  }
}

export const videoProvider: VideoProvider = new MockVideoProvider();
