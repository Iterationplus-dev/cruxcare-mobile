<template>
  <div class="cc-field">
    <label v-if="label" :for="inputId" class="cc-field__label">{{ label }}</label>
    <div
      class="cc-field__control"
      :class="{ 'cc-field__control--focused': focused, 'cc-field__control--error': !!error || invalid }"
    >
      <span v-if="$slots.leading" class="cc-field__slot cc-field__slot--leading">
        <slot name="leading" />
      </span>
      <input
        :id="inputId"
        class="cc-field__input"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :aria-invalid="!!error"
        :aria-describedby="describedBy"
        @input="onInput"
        @blur="onBlur"
        @focus="focused = true"
      />
      <span v-if="$slots.trailing" class="cc-field__slot cc-field__slot--trailing">
        <slot name="trailing" />
      </span>
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="cc-field__error" role="alert">{{ error }}</p>
    <p v-else-if="helper" :id="`${inputId}-helper`" class="cc-field__helper">{{ helper }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Widened to accept vee-validate's Ref<string | undefined> field bindings directly. */
    modelValue: string | undefined;
    label?: string;
    placeholder?: string;
    type?: string;
    helper?: string;
    error?: string;
    /** Border/background error styling without a message — for fields whose
     * shared error is shown once elsewhere (e.g. a banner above the form). */
    invalid?: boolean;
    disabled?: boolean;
    inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'decimal' | 'none' | 'search' | 'url';
    autocomplete?: string;
    /** Validate on blur per README "Forms: inline validation on blur". */
    onBlurValidate?: () => void;
  }>(),
  { type: 'text' },
);

const emit = defineEmits<{ 'update:modelValue': [string]; blur: [] }>();

const inputId = `cc-input-${useId()}`;
const focused = ref(false);

const describedBy = computed(() => {
  if (props.error) return `${inputId}-error`;
  if (props.helper) return `${inputId}-helper`;
  return undefined;
});

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
function onBlur() {
  focused.value = false;
  props.onBlurValidate?.();
  emit('blur');
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
  font-size: 13px;
  line-height: 19px;
  color: var(--cc-ink-900);
  margin-bottom: 4px;
}
.cc-field__control {
  display: flex;
  align-items: center;
  height: var(--cc-input-height);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 0 12px;
  background: var(--cc-surface-0);
  transition:
    border-color var(--cc-motion-fast) var(--cc-ease-out),
    background var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-field__control--focused {
  border: 1.5px solid var(--cc-color-primary);
}
.cc-field__control--error {
  border: 1.5px solid var(--cc-input-error-border);
  background: var(--cc-error-surface);
}
.cc-field__input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--cc-font-interface);
  font-size: 14px;
  line-height: 20px;
  color: var(--cc-ink-900);
  min-width: 0;
}
.cc-field__input::placeholder {
  color: var(--cc-ink-300);
}
.cc-field__input:disabled {
  color: var(--cc-ink-300);
}
.cc-field__slot--leading {
  margin-right: 8px;
  display: flex;
  align-items: center;
}
.cc-field__slot--trailing {
  margin-left: 8px;
  display: flex;
  align-items: center;
}
.cc-field__helper {
  font-family: var(--cc-font-interface);
  font-weight: 400;
  font-size: 11px;
  line-height: 16px;
  color: var(--cc-ink-400);
  margin: 5px 0 0;
}
.cc-field__error {
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 11px;
  line-height: 16px;
  color: var(--cc-error-surface-text);
  margin: 5px 0 0;
}
</style>
