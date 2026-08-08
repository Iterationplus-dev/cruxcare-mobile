<template>
  <span class="cc-badge" :class="`cc-badge--${tone}`">{{ label }}</span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }>(),
  { tone: 'default' },
);
</script>

<style scoped>
.cc-badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--cc-radius-pill);
  padding: 2px 8px;
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 10px;
  line-height: 15px;
  background: var(--cc-color-mist);
  color: var(--cc-color-primary-dark);
}
.cc-badge--success {
  background: rgba(46, 158, 91, 0.14);
  color: var(--cc-color-success-text);
}
.cc-badge--warning {
  background: var(--cc-color-warning-tint);
  color: var(--cc-color-warning-text);
}
.cc-badge--danger {
  background: var(--cc-error-surface);
  color: var(--cc-error-surface-text);
}
</style>
