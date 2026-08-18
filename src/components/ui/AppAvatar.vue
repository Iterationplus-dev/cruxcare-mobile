<template>
  <span class="cc-avatar" :style="{ width: `${size}px`, height: `${size}px` }">
    <img
      v-if="src && !imageFailed"
      :src="src"
      :alt="alt"
      class="cc-avatar__img"
      @error="imageFailed = true"
    />
    <span v-else class="cc-avatar__initials" :style="{ fontSize: `${size * 0.4}px` }">{{
      initials
    }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ name: string; src?: string; size?: number; alt?: string }>(),
  { size: 40 },
);

/** A remote portrait that fails to load falls back to initials rather than
 * leaving an empty circle — remote hosts are not always reachable. */
const imageFailed = ref(false);
watch(() => props.src, () => { imageFailed.value = false; });

const initials = computed(() =>
  props.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
);
</script>

<style scoped>
.cc-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--cc-radius-pill);
  overflow: hidden;
  background: var(--cc-color-mist);
  color: var(--cc-color-primary-dark);
  flex-shrink: 0;
}
.cc-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cc-avatar__initials {
  font-family: var(--cc-font-interface);
  font-weight: 700;
}
</style>
