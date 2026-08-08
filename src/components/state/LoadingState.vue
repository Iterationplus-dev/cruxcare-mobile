<template>
  <div class="cc-loading">
    <slot>
      <StateSkeleton height="120px" radius="18px" style="margin-bottom: 14px" />
      <div style="display: flex; gap: 10px; margin-bottom: 16px">
        <StateSkeleton height="52px" radius="14px" />
        <StateSkeleton height="52px" radius="14px" />
      </div>
      <StateSkeleton width="38%" height="12px" style="margin-bottom: 14px" />
    </slot>
    <p class="cc-loading__sr-only" role="status" aria-live="polite">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import StateSkeleton from './StateSkeleton.vue';

/** N1 — skeleton mirrors the real layout; exactly one live-region message per screen. */
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' });
</script>

<style scoped>
.cc-loading__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
