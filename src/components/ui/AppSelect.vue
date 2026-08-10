<template>
  <div class="cc-field">
    <label v-if="label" :for="selectId" class="cc-field__label">{{ label }}</label>
    <div class="cc-field__control" :class="{ 'cc-field__control--error': !!error }">
      <select
        :id="selectId"
        class="cc-select__input"
        :value="modelValue"
        :aria-invalid="!!error"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <AppIcon name="expand_more" :size="18" color="var(--cc-ink-400)" />
    </div>
    <p v-if="error" class="cc-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import AppIcon from './AppIcon.vue';

defineProps<{
  modelValue: string | undefined;
  label?: string;
  placeholder?: string;
  error?: string;
  options: { value: string; label: string }[];
}>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
const selectId = `cc-select-${useId()}`;

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value);
}
</script>

<style scoped>
.cc-field {
  display: flex;
  flex-direction: column;
}
.cc-field__label {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  line-height: 20px;
  color: var(--cc-ink-900);
  margin-bottom: 4px;
}
.cc-field__control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--cc-input-height);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 0 12px;
  background: var(--cc-surface-0);
}
.cc-field__control--error {
  border: 1.5px solid var(--cc-input-error-border);
  background: var(--cc-error-surface);
}
.cc-select__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  appearance: none;
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  color: var(--cc-ink-900);
  min-width: 0;
}
.cc-field__error {
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-error-surface-text);
  margin: 5px 0 0;
}
</style>
