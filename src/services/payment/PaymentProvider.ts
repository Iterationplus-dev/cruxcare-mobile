import type { PaymentChannel, PaymentGatewayConfig, PaymentProviderId } from '@/types/payments';

/**
 * The provider-facing shape of a payment the API has already opened. Every
 * field is server-issued: the app forwards a quote, it never composes one.
 */
export interface PaymentRequest {
  /** Merchant reference minted by the CruxCare API. */
  reference: string;
  /** Major units, matching the rest of the API. */
  amount: number;
  currency: string;
  description: string;
  customerName: string;
  customerEmail: string;
  /** Null falls back to the build-time gateway configuration. */
  gateway: PaymentGatewayConfig | null;
  /**
   * Opens the sheet on the rail the customer chose. Providers that cannot
   * restrict their checkout ignore it and show their full menu — which is why
   * no screen may present the choice as binding.
   */
  channel?: PaymentChannel;
}

/**
 * What the *device* observed. Deliberately coarse, because none of it is
 * authoritative — `authorized` means "the sheet said it went through", not
 * "the money is ours". Only the API's confirmation settles a payment.
 */
export type PaymentOutcome = 'authorized' | 'pending' | 'cancelled' | 'failed';

export interface PaymentResult {
  outcome: PaymentOutcome;
  /** The gateway's own reference, passed to the API so it can verify. */
  gatewayReference: string | null;
  /** Echo of the merchant reference this attempt belonged to. */
  reference: string;
  /** Provider-supplied detail, safe to log; not necessarily safe to show. */
  message: string | null;
}

/**
 * Payment gateways differ in what they can do. A one-off charge is the only
 * capability every provider has, so it is the only required method — a
 * provider with no vaulting flow simply omits `collectPaymentMethod`, and
 * callers check for it rather than being handed a method that always throws.
 *
 * Card details never touch CruxCare servers or this app: they are entered in
 * the provider's own native sheet or hosted page.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;

  /** Opens the provider's checkout for an already-priced payment. */
  collectPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Vaults a reusable instrument and resolves an opaque token. Present only
   * on providers that actually support saving a payment method.
   */
  collectPaymentMethod?(): Promise<{ token: string; label: string }>;
}

/**
 * Stands in for a hosted checkout while a build has no gateway configured.
 * It always "succeeds" — which is exactly why it must never be selected for a
 * build pointed at a real API.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = 'mock' as const;

  async collectPayment(request: PaymentRequest): Promise<PaymentResult> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      outcome: 'authorized',
      gatewayReference: `mock-txn-${crypto.randomUUID()}`,
      reference: request.reference,
      message: 'Mock gateway approved this payment.',
    };
  }

  async collectPaymentMethod(): Promise<{ token: string; label: string }> {
    // Stands in for a hosted card sheet - no card data is collected or stored here.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { token: `mock-pay-${crypto.randomUUID()}`, label: 'CruxCare wallet' };
  }
}
