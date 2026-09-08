/**
 * The SFU is Daily (backend note §12). Code against this interface: the UI —
 * mute, camera, recording, participant tiles — does not change when the real
 * client SDK is wired in, only the implementation below does.
 *
 * The app joins with a URL and token minted by our API for this appointment.
 * It never names a room: a client that could name its own room could join
 * someone else's session.
 */
export interface VideoCredentials {
  url: string;
  token: string;
  roomId: string;
}

export interface VideoRoomHandle {
  roomId: string;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  /**
   * Only ever reachable once the API says both participants consent — the
   * host's token does not carry the ability otherwise, so this is a control
   * the server has already permitted, not one the app decides to allow.
   */
  setRecording(recording: boolean): Promise<void>;
}

export interface VideoProvider {
  join(credentials: VideoCredentials): Promise<VideoRoomHandle>;
}

/**
 * Stands in until the Daily client SDK is added. It reaches the same states the
 * real one does, so the screen's flow — join, consent, record, leave — is
 * exercisable end to end against the mock API.
 */
export class MockVideoProvider implements VideoProvider {
  async join({ roomId }: VideoCredentials): Promise<VideoRoomHandle> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      roomId,
      leave: async () => {},
      setMuted: async () => {},
      setCameraEnabled: async () => {},
      setRecording: async () => {},
    };
  }
}

export const videoProvider: VideoProvider = new MockVideoProvider();
