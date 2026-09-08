import {
  Monnify,
  type MonnifyChargeResult,
  type MonnifyPaymentMethod,
  type MonnifyTransactionStatus,
} from '@cruxcare/capacitor-monnify';
import type { PaymentChannel, PaymentGatewayConfig } from '@/types/payments';
import type { PaymentOutcome, PaymentProvider, PaymentRequest, PaymentResult } from './PaymentProvider';

/**
 * Drives Monnify's own checkout - the native SDK sheet on Android, the hosted
 * modal in a browser. Card and account credentials are entered inside that
 * sheet, so nothing sensitive passes through this app.
 *
 * `collectPaymentMethod` is intentionally absent: Monnify's checkout SDK
 * charges a single transaction and has no vaulting flow, and pretending
 * otherwise would put a "saved card" in the UI that cannot be charged again.
 */
export class MonnifyPaymentProvider implements PaymentProvider {
  readonly id = 'monnify' as const;

  /** Re-applied whenever the server sends different credentials. */
  private applied: string | null = null;

  constructor(private readonly fallback: PaymentGatewayConfig | null) {}

  async collectPayment(request: PaymentRequest): Promise<PaymentResult> {
    const config = this.resolveConfig(request.gateway);
    if (!config) {
      throw new Error('No Monnify merchant credentials are available for this build.');
    }

    await this.configure(config);

    const methods = methodsFor(request.channel);
    const result = await Monnify.charge({
      amount: request.amount,
      currencyCode: request.currency,
      paymentReference: request.reference,
      paymentDescription: request.description,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      ...(methods ? { paymentMethods: methods } : {}),
    });

    return {
      outcome: outcomeFor(result.status),
      gatewayReference: referenceFrom(result),
      reference: request.reference,
      message: result.message,
    };
  }

  /**
   * Server-supplied credentials win, so keys and TEST/LIVE can be rotated
   * without shipping a release; the build-time values only cover a backend
   * that has not started sending them yet.
   */
  private resolveConfig(fromServer: PaymentGatewayConfig | null): PaymentGatewayConfig | null {
    if (fromServer && fromServer.apiKey && fromServer.contractCode) return fromServer;
    return this.fallback;
  }

  private async configure(config: PaymentGatewayConfig): Promise<void> {
    const fingerprint = `${config.apiKey}:${config.contractCode}:${config.mode}`;
    if (this.applied === fingerprint) return;

    await Monnify.configure({
      apiKey: config.apiKey,
      contractCode: config.contractCode,
      applicationMode: config.mode,
    });
    this.applied = fingerprint;
  }
}

/**
 * Narrows Monnify's sheet to the rail the customer chose. An unrecognised or
 * absent channel returns undefined, which leaves the merchant's own default
 * menu in place — safer than guessing a restriction that hides the only
 * method a customer can actually use.
 */
function methodsFor(channel: PaymentChannel | undefined): MonnifyPaymentMethod[] | undefined {
  switch (channel) {
    case 'card':
      return ['CARD'];
    case 'bank-transfer':
      return ['ACCOUNT_TRANSFER'];
    default:
      return undefined;
  }
}

/**
 * `OVERPAID` is an authorization too - money did arrive, and reconciling the
 * excess is the server's job. `PARTIALLY_PAID` and `PENDING` stay pending so
 * no screen can claim success before the API confirms one.
 */
function outcomeFor(status: MonnifyTransactionStatus): PaymentOutcome {
  switch (status) {
    case 'PAID':
    case 'OVERPAID':
      return 'authorized';
    case 'PARTIALLY_PAID':
    case 'PENDING':
      return 'pending';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'failed';
  }
}

/**
 * Monnify's transaction reference is what the API verifies. A cancelled sheet
 * has none, and falling back to the merchant reference there would hand the
 * server something it cannot look up.
 */
function referenceFrom(result: MonnifyChargeResult): string | null {
  return result.transactionReference?.trim() || null;
}
