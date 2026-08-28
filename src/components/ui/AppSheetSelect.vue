<template>
  <div class="cc-field">
    <label v-if="label" :id="labelId" class="cc-field__label">{{ label }}</label>
    <button
      type="button"
      class="cc-sheet-select__trigger"
      :class="{ 'cc-sheet-select__trigger--error': !!error }"
      :aria-labelledby="label ? labelId : undefined"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = true"
    >
      <span
        :class="selectedLabel ? 'cc-text-body' : 'cc-sheet-select__placeholder'"
        style="font-size: 14.5px"
      >
        {{ selectedLabel ?? placeholder }}
      </span>
      <AppIcon name="expand_more" :size="18" color="var(--cc-ink-400)" />
    </button>
    <p v-if="error" class="cc-field__error" role="alert">{{ error }}</p>

    <AppSheet v-model="open" :title="title ?? label">
      <div class="cc-sheet-select__options">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="cc-sheet-select__option"
          :class="{ 'cc-sheet-select__option--selected': modelValue === opt.value }"
          :aria-pressed="modelValue === opt.value"
          @click="select(opt.value)"
        >
          <span class="cc-text-body" style="font-size: 14.5px">{{ opt.label }}</span>
          <AppIcon
            v-if="modelValue === opt.value"
            name="check_circle"
            :size="20"
            color="var(--cc-color-primary)"
          />
        </button>

        <!-- Only offered once there is something to remove. Without it a value
             can be changed but never taken back, which would leave the API's
             cleared state unreachable from the screen. -->
        <button
          v-if="clearable && selectedLabel"
          type="button"
          class="cc-sheet-select__clear"
          @click="select('')"
        >
          {{ clearLabel }}
        </button>
      </div>
    </AppSheet>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import AppIcon from './AppIcon.vue';
import AppSheet from './AppSheet.vue';

/**
 * A select that opens as a bottom sheet rather than the platform's native
 * dropdown, so the options are reachable with a thumb and styled like the rest
 * of the app. Same props as `AppSelect`, so the two are interchangeable.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | undefined;
    label?: string;
    /** Heading inside the sheet. Falls back to `label`. */
    title?: string;
    placeholder?: string;
    error?: string;
    options: { value: string; label: string }[];
    /** Adds a row that returns the field to its placeholder, emitting ''. */
    clearable?: boolean;
    clearLabel?: string;
  }>(),
  { placeholder: 'Select one', clearable: false, clearLabel: 'Clear selection' },
);

const emit = defineEmits<{ 'update:modelValue': [string] }>();

const open = ref(false);
const labelId = `cc-sheet-select-${useId()}`;
const selectedLabel = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label,
);

function select(value: string) {
  emit('update:modelValue', value);
  open.value = false;
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
.cc-sheet-select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--cc-input-height);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 0 12px;
  background: var(--cc-surface-0);
  cursor: pointer;
  text-align: left;
}
.cc-sheet-select__trigger--error {
  border: 1.5px solid var(--cc-input-error-border);
  background: var(--cc-error-surface);
}
.cc-sheet-select__placeholder {
  font-family: var(--cc-font-interface);
  color: var(--cc-ink-300);
}
.cc-field__error {
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-error-surface-text);
  margin: 5px 0 0;
}
.cc-sheet-select__options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.cc-sheet-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 14px;
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  cursor: pointer;
}
.cc-sheet-select__option--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-sheet-select__clear {
  height: 44px;
  margin-top: 2px;
  border: none;
  border-radius: var(--cc-radius-md);
  background: transparent;
  color: var(--cc-ink-500);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
</style>
