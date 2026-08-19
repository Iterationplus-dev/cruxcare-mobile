import { WebPlugin } from '@capacitor/core';
import type {
  MonnifyChargeRequest,
  MonnifyChargeResult,
  MonnifyConfiguration,
  MonnifyPlugin,
  MonnifySupportResult,
  MonnifyTransactionStatus,
} from './definitions';

const SDK_URL = 'https://sdk.monnify.com/plugin/monnify.js';

interface MonnifyWebResponse {
  transactionReference?: string;
  paymentReference?: string;
  paymentStatus?: string;
  amountPaid?: number | string;
  authorizedAmount?: number | string;
  paidOn?: string;
  paymentMethod?: string;
  responseMessage?: string;
  message?: string;
}

interface MonnifyWebSdk {
  initialize(options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    MonnifySDK?: MonnifyWebSdk;
  }
}

/**
 * The browser SDK reports `USER_CANCELLED`; everything else already matches
 * the native `Status` vocabulary. An unrecognised value is deliberately mapped
 * to `PENDING` rather than to a success or a failure, because the only honest
 * answer the device can give about an unknown state is "ask the server".
 */
function toStatus(value: string | undefined): MonnifyTransactionStatus {
  switch (value) {
    case 'PAID':
    case 'OVERPAID':
    case 'PARTIALLY_PAID':
    case 'PENDING':
    case 'FAILED':
    case 'CANCELLED':
    case 'PAYMENT_GATEWAY_ERROR':
      return value;
    case 'USER_CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}

function toNumber(value: number | string | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Browser fallback so `npm run dev` exercises the same provider code path as a
 * device build. It drives Monnify's hosted checkout modal, which — like the
 * native sheet — collects the card itself and hands back only references.
 */
export class MonnifyWeb extends WebPlugin implements MonnifyPlugin {
  private config: MonnifyConfiguration | null = null;
  private loader: Promise<MonnifyWebSdk> | null = null;

  async configure(options: MonnifyConfiguration): Promise<void> {
    if (!options?.apiKey || !options?.contractCode) {
      throw this.unavailable('Monnify needs both an API key and a contract code.');
    }
    this.config = options;
  }

  async isSupported(): Promise<MonnifySupportResult> {
    return { supported: true, platform: 'web', configured: this.config !== null };
  }

  async charge(request: MonnifyChargeRequest): Promise<MonnifyChargeResult> {
    const config = this.config;
    if (!config) throw this.unavailable('Monnify has not been configured yet.');

    const sdk = await this.load();

    return new Promise<MonnifyChargeResult>((resolve, reject) => {
      let settled = false;

      // `onClose` also fires after a completed payment, so the first callback
      // to arrive wins and later ones are ignored.
      const settle = (result: MonnifyChargeResult) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      const toResult = (response: MonnifyWebResponse): MonnifyChargeResult => ({
        status: toStatus(response?.paymentStatus),
        transactionReference: response?.transactionReference ?? null,
        paymentReference: response?.paymentReference ?? request.paymentReference,
        amountPaid: toNumber(response?.amountPaid),
        amountPayable: toNumber(response?.authorizedAmount) ?? request.amount,
        currencyCode: request.currencyCode,
        paymentMethod: response?.paymentMethod ?? null,
        paidOn: response?.paidOn ?? null,
        message: response?.responseMessage ?? response?.message ?? null,
      });

      try {
        sdk.initialize({
          amount: request.amount,
          currency: request.currencyCode,
          reference: request.paymentReference,
          customerFullName: request.customerName,
          customerEmail: request.customerEmail,
          apiKey: config.apiKey,
          contractCode: config.contractCode,
          paymentDescription: request.paymentDescription,
          ...(request.metadata ? { metadata: request.metadata } : {}),
          ...(request.paymentMethods ? { paymentMethods: request.paymentMethods } : {}),
          onComplete: (response: MonnifyWebResponse) => settle(toResult(response)),
          onClose: (response: MonnifyWebResponse) =>
            settle(toResult({ paymentStatus: 'USER_CANCELLED', ...response })),
        });
      } catch (error) {
        settled = true;
        reject(error instanceof Error ? error : new Error('Monnify checkout could not be opened.'));
      }
    });
  }

  private load(): Promise<MonnifyWebSdk> {
    if (window.MonnifySDK) return Promise.resolve(window.MonnifySDK);

    this.loader ??= new Promise<MonnifyWebSdk>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
      const script = existing ?? document.createElement('script');

      const onLoad = () => {
        if (window.MonnifySDK) resolve(window.MonnifySDK);
        else fail();
      };
      const fail = () => {
        this.loader = null;
        reject(this.unavailable('The Monnify checkout script could not be loaded.'));
      };

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', fail, { once: true });

      if (!existing) {
        script.src = SDK_URL;
        script.async = true;
        document.head.appendChild(script);
      }
    });

    return this.loader;
  }
}
