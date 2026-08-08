<template>
  <span class="cc-avatar" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="src" :src="src" :alt="alt" class="cc-avatar__img" />
    <span v-else class="cc-avatar__initials" :style="{ fontSize: `${size * 0.4}px` }">{{
      initials
    }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ name: string; src?: string; size?: number; alt?: string }>(),
  { size: 40 },
);

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
