<template>
  <div>
    <div class="cc-otp" role="group" aria-label="Verification code">
      <input
        v-for="(_, i) in length"
        :key="i"
        :ref="(el) => (inputs[i] = el as HTMLInputElement)"
        class="cc-otp__digit"
        :class="{ 'cc-otp__digit--error': !!error }"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="1"
        :value="digits[i] ?? ''"
        :aria-label="`Digit ${i + 1} of ${length}`"
        :aria-invalid="!!error"
        @input="(e) => onInput(i, e)"
        @keydown="(e) => onKeydown(i, e)"
        @paste="onPaste"
      />
    </div>
    <p v-if="error" class="cc-otp__error" role="alert">{{ error }}</p>
    <div class="cc-otp__resend">
      <span v-if="cooldownRemaining > 0" class="cc-text-caption">
        Resend code in {{ cooldownRemaining }}s
      </span>
      <button v-else type="button" class="cc-otp__resend-btn" @click="emit('resend')">
        Resend code
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    length?: number;
    error?: string;
    /** Seconds remaining before "Resend code" becomes tappable again. */
    cooldownRemaining?: number;
  }>(),
  { length: 6, cooldownRemaining: 0 },
);

const emit = defineEmits<{ 'update:modelValue': [string]; complete: [string]; resend: [] }>();

const inputs = ref<(HTMLInputElement | null)[]>([]);
const digits = ref<string[]>(props.modelValue.split(''));

watch(
  () => props.modelValue,
  (v) => {
    if (v !== digits.value.join('')) digits.value = v.split('');
  },
);

function commit() {
  const value = digits.value.join('');
  emit('update:modelValue', value);
  if (value.length === props.length) emit('complete', value);
}

function onInput(i: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '');
  digits.value[i] = raw.slice(-1) ?? '';
  commit();
  if (raw && i < props.length - 1) inputs.value[i + 1]?.focus();
}

function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i] && i > 0) {
    inputs.value[i - 1]?.focus();
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text').replace(/\D/g, '') ?? '';
  if (!text) return;
  e.preventDefault();
  digits.value = text.slice(0, props.length).split('');
  commit();
  inputs.value[Math.min(text.length, props.length) - 1]?.focus();
}

onMounted(() => inputs.value[0]?.focus());
onBeforeUnmount(() => {
  inputs.value = [];
});
</script>

<style scoped>
.cc-otp {
  display: flex;
  gap: 10px;
}
.cc-otp__digit {
  width: 44px;
  height: 52px;
  text-align: center;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  font-family: var(--cc-font-mono);
  font-size: 21px;
  color: var(--cc-ink-900);
  background: var(--cc-surface-0);
}
.cc-otp__digit:focus {
  outline: none;
  border: 1.5px solid var(--cc-color-primary);
}
.cc-otp__digit--error {
  border: 1.5px solid var(--cc-input-error-border);
  background: var(--cc-error-surface);
}
.cc-otp__error {
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-error-surface-text);
  margin: 8px 0 0;
}
.cc-otp__resend {
  margin-top: 16px;
}
.cc-otp__resend-btn {
  background: none;
  border: none;
  padding: 0;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 14.5px;
  cursor: pointer;
  min-height: var(--cc-touch-min);
}
</style>
