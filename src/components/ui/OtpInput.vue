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

/** Spreads a run of digits across the boxes from `start`, then focuses the last one filled. */
function fill(start: number, text: string) {
  const next = [...digits.value];
  const chars = text.slice(0, props.length - start).split('');
  chars.forEach((d, k) => (next[start + k] = d));
  digits.value = next;
  commit();
  inputs.value[Math.min(start + chars.length, props.length) - 1]?.focus();
}

/**
 * No `maxlength="1"` on the boxes: Android keyboards paste a clipboard chip as
 * an ordinary input event, not a `paste`, and the limit cut a whole code down
 * to its first digit. WhatsApp codes have no autofill, so paste is the fast
 * path (backend handoff §19) and has to survive every route in.
 */
function onInput(i: number, e: Event) {
  const target = e.target as HTMLInputElement;
  const raw = target.value.replace(/\D/g, '');
  const old = digits.value[i] ?? '';

  // More than one new digit at once is a paste or autofill, not typing.
  if (raw.length - (old ? 1 : 0) > 1) {
    fill(i, raw);
    target.value = digits.value[i] ?? '';
    return;
  }

  // Typing into a filled box leaves both digits; keep the one just typed.
  const typed = old && raw.length === 2 ? (raw[0] === old ? raw[1] : raw[0]) : raw.slice(-1);
  digits.value[i] = typed;
  target.value = typed;
  commit();
  if (typed && i < props.length - 1) inputs.value[i + 1]?.focus();
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
  // A whole code replaces whatever was there; a fragment continues from the box it landed in.
  if (text.length >= props.length) {
    digits.value = [];
    fill(0, text);
  } else {
    fill(Math.max(0, inputs.value.indexOf(e.target as HTMLInputElement)), text);
  }
}

onMounted(() => inputs.value[0]?.focus());
onBeforeUnmount(() => {
  inputs.value = [];
});
</script>

<style scoped>
.cc-otp {
  display: flex;
  justify-content: center;
  gap: 10px;
}
.cc-otp__digit {
  /* Flexible so any code length divides the row evenly and stays on screen,
     capped so short codes don't stretch into slabs. */
  flex: 1 1 0;
  min-width: 0;
  max-width: 56px;
  height: 56px;
  padding: 0;
  box-sizing: border-box;
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
  text-align: center;
}
.cc-otp__resend {
  margin-top: 16px;
  text-align: center;
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
