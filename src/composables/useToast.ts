import { toastController } from '@ionic/vue';

type ToastTone = 'success' | 'danger' | 'warning' | 'info';

const toneColor: Record<ToastTone, string> = {
  success: 'success',
  danger: 'danger',
  warning: 'warning',
  info: 'medium',
};

/** Thin wrapper over ion toastController so screens don't each own overlay lifecycle. */
export function useToast() {
  async function show(message: string, tone: ToastTone = 'info', durationMs = 3000) {
    const toast = await toastController.create({
      message,
      duration: durationMs,
      color: toneColor[tone],
      position: 'bottom',
      swipeGesture: 'vertical',
    });
    await toast.present();
    return toast;
  }

  return { show };
}
