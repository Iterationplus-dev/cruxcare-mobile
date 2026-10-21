/**
 * The SFU is Daily (backend note §12). Screens code against this interface:
 * the UI — mute, camera, recording, participant tiles — does not depend on
 * which implementation is behind it.
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

/** One person in the call, with whatever media they are sending right now. */
export interface VideoParticipant {
  id: string;
  local: boolean;
  name: string;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
}

/** Why the call ended without this person pressing leave. */
export type VideoEndReason = 'ended' | 'error';

export interface VideoRoomHandle {
  roomId: string;
  leave(): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  setCameraEnabled(enabled: boolean): Promise<void>;
  /** Front to back and back again. A no-op on a device with one camera. */
  flipCamera(): Promise<void>;
  /**
   * Only ever reachable once the API says both participants consent — the
   * host's token does not carry the ability otherwise, so this is a control
   * the server has already permitted, not one the app decides to allow.
   */
  setRecording(recording: boolean): Promise<void>;
  /** Called with everyone in the call whenever anyone joins, leaves or changes
   *  what they send. Returns the unsubscribe. */
  onParticipants(listener: (participants: VideoParticipant[]) => void): () => void;
  /** The call ended from the other side: the host ended it, or it dropped. */
  onEnded(listener: (reason: VideoEndReason, message?: string) => void): () => void;
}

export interface VideoProvider {
  join(credentials: VideoCredentials): Promise<VideoRoomHandle>;
}

/**
 * Used against the mock API, where there is no real room to join. It reaches
 * the same states the real one does, so the screen's flow — join, consent,
 * record, leave — is exercisable end to end without a camera.
 */
export class MockVideoProvider implements VideoProvider {
  async join({ roomId }: VideoCredentials): Promise<VideoRoomHandle> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      roomId,
      leave: async () => {},
      setMuted: async () => {},
      setCameraEnabled: async () => {},
      flipCamera: async () => {},
      setRecording: async () => {},
      onParticipants: () => () => {},
      onEnded: () => () => {},
    };
  }
}
