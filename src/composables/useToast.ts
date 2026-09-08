import { readonly, ref } from 'vue';
import { ApiError } from '@/types/api';

export type ToastTone = 'success' | 'danger' | 'warning' | 'info';

export interface FeedbackOptions {
  title?: string;
  dismissLabel?: string;
  /** Auto-dismiss only when a short-lived status is more appropriate than acknowledgement. */
  durationMs?: number;
  /** The server's id for this failure, shown so it can be quoted to support.
   *  Filled in automatically when an `ApiError` is passed instead of a string. */
  reference?: string;
}

export interface FeedbackMessage {
  id: number;
  message: string;
  tone: ToastTone;
  title: string;
  dismissLabel: string;
  durationMs?: number;
  reference?: string;
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
  /**
   * Pass the `ApiError` itself rather than its message wherever there is one:
   * the sheet then shows the server's reference alongside the sanitised copy,
   * which is the difference between "it failed" and something support can act
   * on. A plain string still works and carries no reference.
   */
  function show(
    message: string | ApiError,
    tone: ToastTone = 'info',
    options?: number | FeedbackOptions,
  ) {
    const resolved = normalizeOptions(options);
    const fallback = defaults[tone];
    const fromError = message instanceof ApiError ? message : null;
    const feedback: FeedbackMessage = {
      id: ++nextId,
      message: fromError ? fromError.message : (message as string),
      tone,
      title: resolved.title ?? fallback.title,
      dismissLabel: resolved.dismissLabel ?? fallback.dismissLabel,
      durationMs: resolved.durationMs,
      reference: resolved.reference ?? fromError?.reference,
    };

    queue.push(feedback);
    if (!active.value) presentNext();
    return Promise.resolve();
  }

  return { active: readonly(active), show, dismiss };
}
