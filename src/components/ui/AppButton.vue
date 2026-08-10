<template>
  <button
    type="button"
    class="cc-btn"
    :class="[`cc-btn--${variant}`, { 'cc-btn--full': fullWidth, 'cc-btn--loading': loading }]"
    :disabled="disabled || loading"
    :aria-busy="loading"
    @click="(e) => emit('click', e)"
  >
    <span v-if="loading" class="cc-btn__spinner" aria-hidden="true" />
    <AppIcon v-if="icon && !loading" :name="icon" :size="18" class="cc-btn__icon" />
    <span class="cc-btn__label"><slot>{{ label }}</slot></span>
  </button>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/**
 * Button variants per README "Component specs": primary/secondary/text are
 * distinct components in the design, not CSS tweaks on one base — heights,
 * borders and type weights differ, so each gets its own class block.
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'text' | 'destructive-text';
    label?: string;
    icon?: string;
    fullWidth?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }>(),
  {
    variant: 'primary',
    label: undefined,
    icon: undefined,
    fullWidth: true,
    loading: false,
    disabled: false,
  },
);

const emit = defineEmits<{ click: [MouseEvent] }>();
</script>

<style scoped>
.cc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--cc-space-2);
  border-radius: var(--cc-radius-md);
  font-family: var(--cc-font-interface);
  cursor: pointer;
  transition: background var(--cc-motion-fast) var(--cc-ease-out);
  min-height: var(--cc-touch-min);
}
.cc-btn--full {
  width: 100%;
}
.cc-btn:disabled {
  cursor: not-allowed;
}

.cc-btn--primary {
  height: var(--cc-button-height);
  border: none;
  background: var(--cc-color-primary);
  color: #ffffff;
  font-weight: 600;
  font-size: 16px;
  line-height: 22px;
}
.cc-btn--primary:active:not(:disabled) {
  background: var(--cc-color-primary-dark);
}
.cc-btn--primary:disabled {
  background: #dce7e3;
  color: #8a9a93;
}

.cc-btn--secondary {
  height: var(--cc-button-height);
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  color: var(--cc-ink-900);
  font-weight: 600;
  font-size: 14.5px;
  line-height: 21px;
}
.cc-btn--secondary:disabled {
  color: var(--cc-ink-300);
}

.cc-btn--text {
  height: var(--cc-textbutton-height);
  background: transparent;
  border: none;
  color: var(--cc-color-primary);
  font-weight: 600;
  font-size: 14.5px;
  line-height: 21px;
  width: auto;
}

.cc-btn--destructive-text {
  height: var(--cc-textbutton-height);
  background: transparent;
  border: none;
  color: var(--cc-error-surface-text);
  font-weight: 600;
  font-size: 13.5px;
  line-height: 20px;
  width: auto;
}

.cc-btn__spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #ffffff;
  border-radius: 999px;
  animation: cc-spin 800ms linear infinite;
  display: inline-block;
}
.cc-btn--secondary .cc-btn__spinner,
.cc-btn--text .cc-btn__spinner {
  border-color: rgba(14, 124, 107, 0.3);
  border-top-color: var(--cc-color-primary);
}

@keyframes cc-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cc-btn__spinner {
    animation-duration: 1.001ms;
  }
}
</style>
