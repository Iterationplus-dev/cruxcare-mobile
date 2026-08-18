import { readonly, ref } from 'vue';

export type ToastTone = 'success' | 'danger' | 'warning' | 'info';

export interface FeedbackOptions {
  title?: string;
  dismissLabel?: string;
  /** Auto-dismiss only when a short-lived status is more appropriate than acknowledgement. */
  durationMs?: number;
}

export interface FeedbackMessage {
  id: number;
  message: string;
  tone: ToastTone;
  title: string;
  dismissLabel: string;
  durationMs?: number;
}

const defaults: Record<ToastTone, Pick<FeedbackMessage, 'title' | 'dismissLabel'>> = {
  success: { title: 'All set', dismissLabel: 'Done' },
  danger: { title: 'Something went wrong', dismissLabel: 'Try again' },
  warning: { title: 'Please check this', dismissLabel: 'Okay' },
  info: { title: 'Good to know', dismissLabel: 'Okay' },
};

const active = ref<FeedbackMessage | null>(null);
const queue: FeedbackMessage[] = [];
let nextId = 0;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

function clearDismissTimer() {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = undefined;
}

function presentNext() {
  clearDismissTimer();
  active.value = queue.shift() ?? null;

  if (active.value?.durationMs) {
    dismissTimer = setTimeout(dismiss, active.value.durationMs);
  }
}

function normalizeOptions(options?: number | FeedbackOptions): FeedbackOptions {
  return typeof options === 'number' ? { durationMs: options } : options ?? {};
}

function dismiss() {
  presentNext();
}

/**
 * App-wide feedback surface. This deliberately keeps the historic `useToast`
 * API so every existing success, warning, error, and info call now opens the
 * same accessible bottom-sheet dialog instead of an Ionic toast.
 */
export function useToast() {
  function show(message: string, tone: ToastTone = 'info', options?: number | FeedbackOptions) {
    const resolved = normalizeOptions(options);
    const fallback = defaults[tone];
    const feedback: FeedbackMessage = {
      id: ++nextId,
      message,
      tone,
      title: resolved.title ?? fallback.title,
      dismissLabel: resolved.dismissLabel ?? fallback.dismissLabel,
      durationMs: resolved.durationMs,
    };

    queue.push(feedback);
    if (!active.value) presentNext();
    return Promise.resolve();
  }

  return { active: readonly(active), show, dismiss };
}
