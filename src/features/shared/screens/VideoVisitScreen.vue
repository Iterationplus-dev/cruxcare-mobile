<template>
  <ion-page>
    <div class="cc-video">
      <div class="cc-video__topbar">
        <span v-if="recording" class="cc-video__rec">REC</span>
        <span class="cc-video__timer cc-text-mono">{{ elapsed }}</span>
        <button type="button" class="cc-video__flip" aria-label="Flip camera">
          <AppIcon name="flip_camera_ios" :size="24" color="#fff" />
        </button>
      </div>

      <div class="cc-video__stage">
        <!-- Why it could not start, rather than a spinner that never resolves. -->
        <div v-if="problem" class="cc-video__problem">
          <AppIcon name="videocam_off" :size="34" color="#8a9a93" />
          <h2>{{ problem.title }}</h2>
          <p>{{ problem.message }}</p>
          <AppButton v-if="problem.retryable" variant="secondary" :loading="connecting" @click="connect">
            Try again
          </AppButton>
          <AppButton variant="text" @click="router.back()">Back to appointment</AppButton>
        </div>
        <span v-else class="cc-text-mono" style="color: #8a9a93">
          {{ joined ? 'therapist video feed' : 'Connecting…' }}
        </span>
      </div>

      <div v-if="!problem" class="cc-video__self">
        <span class="cc-text-mono" style="color: #8a9a93; font-size: 11.5px">you</span>
      </div>

      <div v-if="!problem" class="cc-video__bottom">
        <!-- An explicit act inside the session it applies to: never pre-ticked,
             never bundled into joining, never inferred from a settings screen. -->
        <div class="cc-video__consent">
          <label class="cc-video__consent-mine">
            <input type="checkbox" :checked="consent.mine" :disabled="savingConsent" @change="onConsentChange" />
            <span>
              <span class="cc-video__consent-title">Allow this session to be recorded</span>
              <span class="cc-video__consent-note">{{ theirsLine }}</span>
            </span>
          </label>
          <p v-if="consent.mine" class="cc-video__consent-warn">
            Turning this off stops the recording straight away. What was already recorded is kept.
          </p>
        </div>

        <div class="cc-video__controls">
          <button type="button" class="cc-video__ctrl" :aria-pressed="muted" aria-label="Toggle microphone" @click="toggleMute">
            <AppIcon :name="muted ? 'mic_off' : 'mic'" :size="26" color="#fff" />
          </button>
          <button type="button" class="cc-video__ctrl" :aria-pressed="!cameraOn" aria-label="Toggle camera" @click="toggleCamera">
            <AppIcon :name="cameraOn ? 'videocam' : 'videocam_off'" :size="26" color="#fff" />
          </button>
          <!-- Gated on canRecord, not on mine && theirs: the server also knows
               whether this environment has anywhere to put a recording. -->
          <button
            v-if="isHost && consent.canRecord"
            type="button"
            class="cc-video__ctrl"
            :class="{ 'cc-video__ctrl--recording': recording }"
            :aria-pressed="recording"
            :aria-label="recording ? 'Stop recording' : 'Start recording'"
            @click="toggleRecording"
          >
            <AppIcon :name="recording ? 'stop_circle' : 'radio_button_checked'" :size="26" color="#fff" />
          </button>
          <button type="button" class="cc-video__ctrl" aria-label="Open chat" @click="openChat">
            <AppIcon name="chat_bubble" :size="26" color="#fff" />
          </button>
          <button
            type="button"
            class="cc-video__ctrl cc-video__ctrl--end"
            :aria-label="isHost ? 'End the session for everyone' : 'Leave call'"
            @click="isHost ? endForEveryone() : leave()"
          >
            <AppIcon name="call_end" :size="26" color="#fff" />
          </button>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { videoProvider, type VideoRoomHandle } from '@/services/video/VideoProvider';
import { videoApi } from '@/api/video.api';
import { videoJoinProblem, type VideoJoinProblem } from '@/features/shared/videoSessionErrors';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import type { RecordingConsent } from '@/types/video';

/** D5 · Video visit — dark surface, 56px controls, recording consent
 * persistent. (White status bar icons set via this route's `darkStatusBar`
 * meta — see router/index.ts.)
 *
 * The room comes from `POST /appointments/{id}/video/token`, asked for here
 * rather than pre-fetched on a list: the token lasts 15 minutes and this is
 * the only screen that spends one. */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const appointmentId = route.params.id as string;

const joined = ref(false);
const connecting = ref(false);
const problem = ref<VideoJoinProblem | null>(null);
const isHost = ref(false);
const recording = ref(false);
const muted = ref(false);
const cameraOn = ref(true);
const seconds = ref(0);
const consent = ref<RecordingConsent>({ mine: false, theirs: false, canRecord: false });
const savingConsent = ref(false);
let room: VideoRoomHandle | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

const elapsed = ref('0:00');
function tick() {
  seconds.value += 1;
  const m = Math.floor(seconds.value / 60);
  const s = seconds.value % 60;
  elapsed.value = `${m}:${s.toString().padStart(2, '0')}`;
}

/** A fact about the other person, so it reads as a status line, never a control. */
const theirsLine = computed(() =>
  consent.value.theirs
    ? 'The other person has agreed.'
    : 'Waiting for the other person to agree. Nothing records until you both do.',
);

/**
 * Re-asks a couple of minutes before the token expires rather than after the
 * call drops. The same room comes back with a fresh token, so this is a
 * refresh and not a second call.
 */
function scheduleRefresh(expiresAt: string) {
  clearTimeout(refreshTimer);
  const lead = new Date(expiresAt).getTime() - Date.now() - 2 * 60 * 1000;
  if (!Number.isFinite(lead)) return;
  refreshTimer = setTimeout(() => void refreshToken(), Math.max(lead, 10_000));
}

async function refreshToken() {
  try {
    const session = await videoApi.token(appointmentId);
    scheduleRefresh(session.expiresAt);
  } catch {
    // The token in hand is good until it expires, so a failed refresh is not
    // worth interrupting a live call for.
  }
}

async function connect() {
  if (connecting.value) return;
  connecting.value = true;
  problem.value = null;

  try {
    const session = await videoApi.token(appointmentId);
    isHost.value = session.role === 'host';
    room = await videoProvider.join({
      url: session.url,
      token: session.token,
      roomId: session.roomId,
    });
    joined.value = true;
    scheduleRefresh(session.expiresAt);
    clearInterval(timer);
    timer = setInterval(tick, 1000);

    // Read after joining, never before: consent belongs inside the session it
    // applies to, and asking first would make it a gate on the call.
    consent.value = await videoApi.consent(appointmentId);
  } catch (error) {
    problem.value = videoJoinProblem(error);
  } finally {
    connecting.value = false;
  }
}

onMounted(() => void connect());

onBeforeUnmount(() => {
  clearInterval(timer);
  clearTimeout(refreshTimer);
  void room?.leave();
});

async function toggleMute() {
  muted.value = !muted.value;
  await room?.setMuted(muted.value);
}
async function toggleCamera() {
  cameraOn.value = !cameraOn.value;
  await room?.setCameraEnabled(cameraOn.value);
}

async function onConsentChange(event: Event) {
  const granted = (event.target as HTMLInputElement).checked;
  savingConsent.value = true;
  try {
    consent.value = await videoApi.setConsent(appointmentId, granted);
    // Withdrawal stops a recording in progress server-side; reflect it here so
    // the REC badge cannot outlive the permission for it.
    if (!consent.value.canRecord && recording.value) {
      recording.value = false;
      await room?.setRecording(false);
    }
  } catch (error) {
    await toast.show(error instanceof ApiError ? error : 'We could not save that. Please try again.', 'danger', {
      title: 'Consent not saved',
    });
  } finally {
    savingConsent.value = false;
  }
}

async function toggleRecording() {
  if (!consent.value.canRecord) return;
  const next = !recording.value;
  await room?.setRecording(next);
  recording.value = next;
}

function openChat() {
  router.push({ name: 'chat-thread', params: { id: appointmentId } });
}

/** Leaving is the provider's own call and needs nothing from the API. */
async function leave() {
  await room?.leave();
  router.back();
}

/** Ejects everyone. The therapist's control only — never the back button. */
async function endForEveryone() {
  try {
    await videoApi.end(appointmentId);
  } catch (error) {
    await toast.show(error instanceof ApiError ? error : 'We could not end the session.', 'danger', {
      title: 'Session not ended',
    });
    return;
  }
  await leave();
}
</script>

<style scoped>
.cc-video {
  height: 100%;
  background: #1a2b22;
  background-image: repeating-linear-gradient(45deg, #22332c 0 12px, #1e2e27 12px 24px);
  display: flex;
  flex-direction: column;
  position: relative;
}
.cc-video__problem {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 300px;
  padding: 0 20px;
  text-align: center;
}
.cc-video__problem h2 {
  margin: 4px 0 0;
  color: #f3efe6;
  font-family: var(--cc-font-interface);
  font-size: 18px;
  font-weight: 700;
}
.cc-video__problem p {
  margin: 0 0 6px;
  color: #8a9a93;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  line-height: 20px;
}
.cc-video__consent-mine {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}
.cc-video__consent-mine input {
  flex: none;
  width: 20px;
  height: 20px;
  margin: 1px 0 0;
  accent-color: var(--cc-color-primary);
}
.cc-video__consent-mine > span {
  display: grid;
  gap: 2px;
}
.cc-video__consent-title {
  color: #f3efe6;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
}
.cc-video__consent-note {
  color: #8a9a93;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-video__consent-warn {
  margin: 8px 0 0;
  color: #8a9a93;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-video__ctrl--recording {
  background: #c1443b;
}
.cc-video__topbar {
  padding: calc(env(safe-area-inset-top) + 8px) 16px 8px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-video__rec {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(193, 68, 59, 0.9);
  color: #fff;
  font: 600 11.5px/16px var(--cc-font-interface);
}
.cc-video__timer {
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}
.cc-video__flip {
  margin-left: auto;
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-video__stage {
  flex: 1;
  display: grid;
  place-items: center;
}
.cc-video__self {
  position: absolute;
  top: 110px;
  right: 16px;
  width: 104px;
  height: 150px;
  border-radius: 16px;
  background: #26332e;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
}
.cc-video__bottom {
  padding: 0 16px 16px;
}
.cc-video__consent {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.cc-video__consent p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: #f2f7f5;
}
.cc-video__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 22px;
}
.cc-video__ctrl {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.cc-video__ctrl--end {
  background: var(--cc-color-danger);
}
</style>
