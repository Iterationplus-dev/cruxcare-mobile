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
        <span class="cc-text-mono" style="color: #8a9a93">{{ joined ? 'therapist video feed' : 'Connecting…' }}</span>
      </div>
      <div class="cc-video__self">
        <span class="cc-text-mono" style="color: #8a9a93; font-size: 11px">you</span>
      </div>
      <div class="cc-video__bottom">
        <div class="cc-video__consent">
          <AppIcon name="info" :size="20" color="#f3efe6" />
          <p>This session is being recorded with your consent. Ask your therapist to stop at any time.</p>
        </div>
        <div class="cc-video__controls">
          <button type="button" class="cc-video__ctrl" :aria-pressed="muted" aria-label="Toggle microphone" @click="toggleMute">
            <AppIcon :name="muted ? 'mic_off' : 'mic'" :size="26" color="#fff" />
          </button>
          <button type="button" class="cc-video__ctrl" :aria-pressed="!cameraOn" aria-label="Toggle camera" @click="toggleCamera">
            <AppIcon :name="cameraOn ? 'videocam' : 'videocam_off'" :size="26" color="#fff" />
          </button>
          <button type="button" class="cc-video__ctrl" aria-label="Open chat" @click="openChat">
            <AppIcon name="chat_bubble" :size="26" color="#fff" />
          </button>
          <button type="button" class="cc-video__ctrl cc-video__ctrl--end" aria-label="Leave call" @click="leave">
            <AppIcon name="call_end" :size="26" color="#fff" />
          </button>
        </div>
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/ui/AppIcon.vue';
import { videoProvider, type VideoRoomHandle } from '@/services/video/VideoProvider';

/** D5 · Video visit — dark surface, 56px controls, recording consent persistent. */
const route = useRoute();
const router = useRouter();

const joined = ref(false);
const recording = ref(true);
const muted = ref(false);
const cameraOn = ref(true);
const seconds = ref(0);
let room: VideoRoomHandle | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

const elapsed = ref('0:00');
function tick() {
  seconds.value += 1;
  const m = Math.floor(seconds.value / 60);
  const s = seconds.value % 60;
  elapsed.value = `${m}:${s.toString().padStart(2, '0')}`;
}

onMounted(async () => {
  room = await videoProvider.join(route.params.id as string);
  joined.value = true;
  timer = setInterval(tick, 1000);
});
onBeforeUnmount(() => {
  clearInterval(timer);
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
function openChat() {
  router.push({ name: 'chat-thread', params: { id: route.params.id } });
}
async function leave() {
  await room?.leave();
  router.back();
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
  font: 600 11px/15px var(--cc-font-interface);
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
  font-size: 11px;
  line-height: 16px;
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
