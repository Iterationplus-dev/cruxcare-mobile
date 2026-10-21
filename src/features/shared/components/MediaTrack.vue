<template>
  <video
    v-if="kind === 'video'"
    ref="element"
    class="cc-media-track"
    :class="{ 'cc-media-track--mirror': mirror }"
    autoplay
    playsinline
    muted
  />
  <audio v-else ref="element" autoplay />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

/**
 * Plays one live track from the call. Video is always muted here — sound
 * comes from the separate audio element — and your own picture is mirrored,
 * the way every camera app shows you to yourself.
 */
const props = withDefaults(
  defineProps<{ track: MediaStreamTrack | null; kind?: 'video' | 'audio'; mirror?: boolean }>(),
  { kind: 'video', mirror: false },
);

const element = ref<HTMLMediaElement | null>(null);

watch(
  [element, () => props.track],
  ([el, track]) => {
    if (!el) return;
    const current = (el.srcObject as MediaStream | null)?.getTracks()[0];
    if (current === track) return;
    el.srcObject = track ? new MediaStream([track]) : null;
    // Autoplay can be refused until the page has had a gesture; Join was one.
    if (track) void el.play().catch(() => undefined);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (element.value) element.value.srcObject = null;
});
</script>

<style scoped>
.cc-media-track {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: transparent;
}
.cc-media-track--mirror {
  transform: scaleX(-1);
}
</style>
