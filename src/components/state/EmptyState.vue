<template>
  <div class="cc-empty">
    <slot name="context" />
    <div class="cc-empty__illustration" aria-hidden="true">
      <AppIcon :name="icon" :size="48" color="var(--cc-ink-300)" />
    </div>
    <div class="cc-empty__title cc-text-h2">{{ title }}</div>
    <p class="cc-empty__message cc-text-subtitle">{{ message }}</p>
    <AppButton v-if="primaryAction" @click="emit('primary')">{{ primaryAction }}</AppButton>
    <AppButton v-if="secondaryAction" variant="secondary" @click="emit('secondary')">{{
      secondaryAction
    }}</AppButton>
  </div>
</template>

<script setup lang="ts">
import AppButton from '../ui/AppButton.vue';
import AppIcon from '../ui/AppIcon.vue';

/**
 * N2 — a real value (e.g. "$0.00") stays visible above this via the
 * `context` slot; empty never means a dead end, so it always offers at
 * least one way out.
 */
withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    message: string;
    primaryAction?: string;
    secondaryAction?: string;
  }>(),
  { icon: 'eco' },
);

const emit = defineEmits<{ primary: []; secondary: [] }>();
</script>

<style scoped>
.cc-empty {
  text-align: center;
  padding: 8px 8px 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.cc-empty__illustration {
  height: 150px;
  border-radius: var(--cc-radius-lg);
  background-image: repeating-linear-gradient(45deg, #eaf3f0 0 8px, #f7faf9 8px 16px);
  display: grid;
  place-items: center;
  margin-bottom: 6px;
}
.cc-empty__title {
  margin: 0;
}
.cc-empty__message {
  margin: 0 0 12px;
}
</style>
