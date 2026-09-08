/** Video session shapes for the /api/v1 contract (backend note §12). */

/** The assigned therapist hosts; the client is a guest. Decided from the case,
 *  never from the request — and administrators are not in the room at all. */
export type VideoRole = 'host' | 'guest';

/**
 * What the API hands back for one join. The app never names a room and never
 * sees the provider key: a client that could name its own room could join
 * someone else's session.
 */
export interface VideoSessionToken {
  provider: string;
  /** Opaque and stable per appointment, so a reconnect rejoins the same call. */
  roomId: string;
  /** Short-lived and participant-scoped — holding one is not holding the room. */
  token: string;
  expiresAt: string;
  role: VideoRole;
  url: string;
}

/**
 * Recording needs a standing yes from both people, and either can withdraw at
 * any moment. Silence is not agreement: someone who has never answered has not
 * consented.
 */
export interface RecordingConsent {
  /** This user's own answer — the only field that is a control. */
  mine: boolean;
  /** The other participant's answer. A status line, never something tappable. */
  theirs: boolean;
  /**
   * The whole answer, including conditions the app cannot see (the environment
   * switch, and whether there is anywhere to store a recording). Gate on this
   * rather than on `mine && theirs`.
   */
  canRecord: boolean;
}
