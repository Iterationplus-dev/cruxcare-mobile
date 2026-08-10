<template>
  <button
    type="button"
    class="cc-chip"
    :class="{ 'cc-chip--selected': selected }"
    :aria-pressed="selected"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; selected?: boolean }>(), { selected: false });
const emit = defineEmits<{ click: [] }>();
</script>

<style scoped>
.cc-chip {
  display: inline-flex;
  align-items: center;
  border-radius: var(--cc-radius-pill);
  padding: 8px 14px;
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  color: var(--cc-ink-600);
  cursor: pointer;
  transition:
    background var(--cc-motion-fast) var(--cc-ease-out),
    color var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-chip--selected {
  background: var(--cc-color-primary);
  border-color: var(--cc-color-primary);
  color: #ffffff;
}
</style>
