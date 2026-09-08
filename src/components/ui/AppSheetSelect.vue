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
      </div>

      <!-- Outside the list, because removing a value is not one of the values.
           Only offered once there is something to remove: without it a value
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
/*
 * One grouped list, not a stack of boxes.
 *
 * Every option used to carry its own border and radius, so a country list read
 * as thirty separate cards — the rule between two rows was doing the same job
 * twice, and the eye had to cross a boundary per item. A single container with
 * hairline separators is the same information with a third of the lines, and it
 * matches how AppCard + AppListRow already group rows elsewhere in the app.
 */
.cc-sheet-select__options {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  max-height: 50vh;
  overflow-y: auto;
  /* A light green edge rather than the neutral hairline: the list is the one
     thing on the sheet asking to be chosen from, and the soft outer glow lifts
     it off the surface without adding another hard line. */
  border: 1px solid rgba(14, 124, 107, 0.28);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  box-shadow: 0 0 0 3px rgba(14, 124, 107, 0.07);
  /* Keeps the first and last rows inside the rounded corners while scrolling. */
  overflow-x: hidden;
}
.cc-sheet-select__option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  /* 39px — a quarter tighter than the 52px it was, as asked, so two more
     options fit before anyone scrolls.
     
     Note this sits below the 44px minimum touch target the handoff lists as
     non-negotiable (README, Accessibility). It is a deliberate instruction, not
     an oversight; raise it before the accessibility pass. 44px would be a 15%
     reduction and the largest that keeps the rule. */
  min-height: 39px;
  padding: 6px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
/* The separator belongs between rows, so the first one does not get a stray
   line under the container's own top border. */
.cc-sheet-select__option + .cc-sheet-select__option {
  border-top: 1px solid rgba(14, 124, 107, 0.16);
}
.cc-sheet-select__option:active {
  background: var(--cc-color-mist);
}
.cc-sheet-select__option:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: -3px;
}
/* Selection is carried by tint, weight and the tick — not by a heavier border,
   which would shift every neighbouring row by half a pixel as it moved. */
.cc-sheet-select__option--selected {
  background: var(--cc-color-mist);
}
.cc-sheet-select__option--selected span {
  font-weight: 600;
  color: var(--cc-color-primary-dark);
}
.cc-sheet-select__clear {
  display: block;
  width: 100%;
  height: 44px;
  margin-top: 10px;
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
