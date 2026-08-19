<template>
  <AppSheet :model-value="modelValue" title="Move and scale" @update:model-value="onSheetToggle">
    <p class="cc-cropper__hint cc-text-caption">Drag to reposition, pinch or use the slider to zoom.</p>

    <div
      ref="frameEl"
      class="cc-cropper__frame"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        v-if="src"
        :src="src"
        class="cc-cropper__image"
        :style="imageStyle"
        alt=""
        draggable="false"
        @load="onImageLoad"
      />
      <div class="cc-cropper__mask" aria-hidden="true" />
    </div>

    <label class="cc-cropper__zoom">
      <AppIcon name="image" :size="16" />
      <input
        :value="transform.scale"
        type="range"
        :min="MIN_SCALE"
        :max="MAX_SCALE"
        step="0.01"
        aria-label="Zoom"
        :disabled="!ready"
        @input="onZoomSlider"
      />
    </label>

    <div class="cc-cropper__actions">
      <AppButton variant="secondary" label="Cancel" @click="close" />
      <AppButton label="Use photo" :disabled="!ready" @click="confirm" />
    </div>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';
import AppSheet from './AppSheet.vue';
import type { AvatarCrop } from '@/utils/avatarImage';
import {
  MAX_SCALE,
  MIN_SCALE,
  centred,
  clampTransform,
  displayRatio,
  panBy,
  toCrop,
  zoomAbout,
  type CropTransform,
  type CropView,
} from '@/utils/cropFrame';

/**
 * Square crop picker. The member pans and zooms the photo behind a fixed
 * window; we report back the region they framed in *source* pixels, leaving
 * the resize step as the single place that touches canvas. All the geometry
 * lives in `@/utils/cropFrame` — this component only measures and applies it.
 */
const props = defineProps<{ modelValue: boolean; file: File | null }>();
const emit = defineEmits<{ 'update:modelValue': [boolean]; confirm: [AvatarCrop] }>();

const frameEl = ref<HTMLElement | null>(null);
const src = ref<string | null>(null);
const natural = ref({ width: 0, height: 0 });
const transform = ref<CropTransform>({ scale: MIN_SCALE, x: 0, y: 0 });
const ready = computed(() => natural.value.width > 0 && natural.value.height > 0);

function view(): CropView {
  return {
    frame: frameEl.value?.clientWidth ?? 0,
    width: natural.value.width,
    height: natural.value.height,
  };
}

const imageStyle = computed(() => {
  const k = displayRatio(view(), transform.value.scale);
  return {
    width: `${natural.value.width * k}px`,
    height: `${natural.value.height * k}px`,
    transform: `translate3d(${transform.value.x}px, ${transform.value.y}px, 0)`,
  };
});

function onImageLoad(event: Event) {
  const img = event.target as HTMLImageElement;
  natural.value = { width: img.naturalWidth, height: img.naturalHeight };
  reset();
}

/** Decode can beat the modal's layout pass; without a measured window every
 * offset would be nonsense, so wait a frame and try again. */
function reset() {
  if (!view().frame) {
    requestAnimationFrame(reset);
    return;
  }
  transform.value = centred(view());
}

function onZoomSlider(event: Event) {
  const centre = view().frame / 2;
  const next = Number((event.target as HTMLInputElement).value);
  transform.value = zoomAbout(view(), transform.value, next, centre, centre);
}

const pointers = new Map<number, { x: number; y: number }>();
let pinchSpread = 0;

function onPointerDown(event: PointerEvent) {
  if (!ready.value) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  pinchSpread = spread();
}

function onPointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId);
  if (!previous) return;
  event.preventDefault();

  const current = { x: event.clientX, y: event.clientY };
  pointers.set(event.pointerId, current);

  if (pointers.size >= 2) {
    const next = spread();
    if (pinchSpread > 0 && next > 0) {
      const focus = midpoint();
      const scale = transform.value.scale * (next / pinchSpread);
      transform.value = zoomAbout(view(), transform.value, scale, focus.x, focus.y);
    }
    pinchSpread = next;
    return;
  }

  transform.value = panBy(view(), transform.value, current.x - previous.x, current.y - previous.y);
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
  pinchSpread = spread();
}

function spread(): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Pinch midpoint, translated from page coordinates into the window's box. */
function midpoint(): { x: number; y: number } {
  const [a, b] = [...pointers.values()];
  const box = frameEl.value?.getBoundingClientRect();
  if (!a || !b || !box) return { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2 - box.left, y: (a.y + b.y) / 2 - box.top };
}

function confirm() {
  const crop = toCrop(view(), clampTransform(view(), transform.value));
  if (!crop) return;
  emit('confirm', crop);
  close();
}

function close() {
  emit('update:modelValue', false);
}

function onSheetToggle(open: boolean) {
  if (!open) close();
}

/** One object URL per selection, revoked as soon as it is replaced or dropped. */
watch(
  () => props.file,
  (file) => {
    if (src.value) URL.revokeObjectURL(src.value);
    natural.value = { width: 0, height: 0 };
    transform.value = { scale: MIN_SCALE, x: 0, y: 0 };
    src.value = file ? URL.createObjectURL(file) : null;
  },
  { immediate: true },
);
</script>

<style scoped>
.cc-cropper__hint {
  margin: 0 0 12px;
  color: var(--cc-ink-400);
}
.cc-cropper__frame {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-ink-900);
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.cc-cropper__frame:active {
  cursor: grabbing;
}
.cc-cropper__image {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  max-width: none;
  pointer-events: none;
}
/* Circular guide: the crop itself is square, but avatars render as circles
   everywhere else, so the member frames what they will actually see. The
   oversized shadow dims the corners and is clipped by the frame's overflow. */
.cc-cropper__mask {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 9999px rgba(26, 43, 34, 0.55);
  border: 2px solid rgba(255, 255, 255, 0.9);
  pointer-events: none;
}
.cc-cropper__zoom {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 0 20px;
  color: var(--cc-ink-400);
}
.cc-cropper__zoom input {
  flex: 1;
  accent-color: var(--cc-ink-900);
}
.cc-cropper__actions {
  display: flex;
  gap: 12px;
}
.cc-cropper__actions > * {
  flex: 1;
}
</style>
