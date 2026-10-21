import Daily, { type DailyCall, type DailyParticipant } from '@daily-co/daily-js';
import type {
  VideoCredentials,
  VideoEndReason,
  VideoParticipant,
  VideoProvider,
  VideoRoomHandle,
} from './VideoProvider';

function toParticipant(p: DailyParticipant): VideoParticipant {
  // `persistentTrack` survives mute/unmute, so a tile does not have to be
  // rebuilt every time someone switches their camera off and on. `state`
  // says whether it is actually carrying media right now.
  const video = p.tracks?.video;
  const audio = p.tracks?.audio;
  return {
    id: p.session_id,
    local: p.local,
    name: p.user_name || (p.local ? 'You' : 'Guest'),
    videoTrack: video?.state === 'playable' ? (video.persistentTrack ?? null) : null,
    audioTrack: !p.local && audio?.state === 'playable' ? (audio.persistentTrack ?? null) : null,
  };
}

/**
 * Daily's call object, inside the WebView. The camera and microphone come from
 * getUserMedia, which Capacitor turns into the Android runtime prompt — the
 * permissions are declared by scripts/patch-android-push-and-monnify.mjs.
 *
 * Daily allows one call object per page, so a handle owns it from join until
 * leave and destroys it on the way out; a second join after that is fine.
 */
export class DailyVideoProvider implements VideoProvider {
  async join({ url, token, roomId }: VideoCredentials): Promise<VideoRoomHandle> {
    const call: DailyCall = Daily.getCallInstance() ?? Daily.createCallObject();

    const participantListeners = new Set<(participants: VideoParticipant[]) => void>();
    const endListeners = new Set<(reason: VideoEndReason, message?: string) => void>();
    let leaving = false;

    const emitParticipants = () => {
      const all = Object.values(call.participants()).map(toParticipant);
      participantListeners.forEach((listener) => listener(all));
    };
    const emitEnded = (reason: VideoEndReason, message?: string) => {
      if (leaving) return;
      endListeners.forEach((listener) => listener(reason, message));
    };

    call
      .on('participant-joined', emitParticipants)
      .on('participant-updated', emitParticipants)
      .on('participant-left', emitParticipants)
      .on('track-started', emitParticipants)
      .on('track-stopped', emitParticipants)
      // The host pressing end ejects everyone; to the guest that is the call
      // ending, not an error.
      .on('left-meeting', () => emitEnded('ended'))
      .on('error', (event) => emitEnded('error', event?.errorMsg));

    try {
      await call.join({ url, token });
    } catch (error) {
      await call.destroy().catch(() => undefined);
      throw error;
    }
    emitParticipants();

    return {
      roomId,
      async leave() {
        leaving = true;
        try {
          await call.leave();
        } finally {
          await call.destroy().catch(() => undefined);
        }
      },
      async setMuted(muted) {
        call.setLocalAudio(!muted);
      },
      async setCameraEnabled(enabled) {
        call.setLocalVideo(enabled);
      },
      async flipCamera() {
        await call.cycleCamera();
      },
      async setRecording(recording) {
        if (recording) call.startRecording();
        else call.stopRecording();
      },
      onParticipants(listener) {
        participantListeners.add(listener);
        listener(Object.values(call.participants()).map(toParticipant));
        return () => participantListeners.delete(listener);
      },
      onEnded(listener) {
        endListeners.add(listener);
        return () => endListeners.delete(listener);
      },
    };
  }
}
