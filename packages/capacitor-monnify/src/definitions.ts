/**
 * Typed surface of the Monnify bridge.
 *
 * The native side is a thin wrapper around Monnify's own checkout SDK
 * (`com.teamapt.monnify.sdk`, artifact `com.monnify.android-sdk:monnify-android-sdk`).
 * Card and account credentials are entered inside Monnify's own activity, so
 * they never pass through this plugin, the WebView, or CruxCare's servers.
 *
 * Nothing here is authoritative about money. `MonnifyChargeResult.status` is
 * what the device happened to observe when the sheet closed; whether a payment
 * actually settled is decided by the CruxCare API after it verifies the
 * transaction with Monnify server-to-server (see
 * `docs/PAYMENTS_MONNIFY_CONTRACT.md`).
 */

export type MonnifyApplicationMode = 'TEST' | 'LIVE';

export interface MonnifyConfiguration {
  /**
   * Merchant API key from the Monnify dashboard. This value is public by
   * design — it identifies the merchant to the SDK. The *secret* key never
   * leaves the CruxCare server.
   */
  apiKey: string;
  contractCode: string;
  /** `TEST` targets Monnify's sandbox; `LIVE` moves real money. */
  applicationMode: MonnifyApplicationMode;
}

/** Methods Monnify may offer in its sheet. Mirrors `com.teamapt.monnify.sdk.model.PaymentMethod`. */
export type MonnifyPaymentMethod =
  | 'CARD'
  | 'ACCOUNT_TRANSFER'
  | 'DIRECT_DEBIT'
  | 'USSD'
  | 'PHONE_NUMBER';

export interface MonnifyChargeRequest {
  /**
   * Amount in major units (₦1,500.00 is `1500`). Server-issued: the caller
   * passes back the amount the CruxCare API quoted, it is never derived here.
   */
  amount: number;
  /** ISO-4217, e.g. `NGN`. */
  currencyCode: string;
  /**
   * The merchant reference minted by the CruxCare API when it opened the
   * payment intent. Never generated on the device — the backend has to be
   * able to recognise the reference when Monnify's webhook arrives.
   */
  paymentReference: string;
  paymentDescription: string;
  customerName: string;
  customerEmail: string;
  /**
   * Echoed back to the merchant on Monnify's webhook. Keep it to opaque
   * server-issued correlation values; it is not a private channel.
   */
  metadata?: Record<string, string>;
  /** Restrict which methods the sheet offers. Omit for the merchant default. */
  paymentMethods?: MonnifyPaymentMethod[];
}

/**
 * Mirrors `com.teamapt.monnify.sdk.Status`. `CANCELLED` is what the SDK
 * reports when the customer dismisses the sheet without paying.
 */
export type MonnifyTransactionStatus =
  | 'PAID'
  | 'OVERPAID'
  | 'PARTIALLY_PAID'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAYMENT_GATEWAY_ERROR';

export interface MonnifyChargeResult {
  /** Display-only. Treat every value other than a server confirmation as unsettled. */
  status: MonnifyTransactionStatus;
  /** Monnify's own reference. The value the CruxCare API verifies against. */
  transactionReference: string | null;
  /** The merchant reference this charge was opened with. */
  paymentReference: string | null;
  amountPaid: number | null;
  amountPayable: number | null;
  currencyCode: string | null;
  /** `CARD`, `BANK_TRANSFER`, `USSD`, … as reported by the SDK. */
  paymentMethod: string | null;
  paidOn: string | null;
  message: string | null;
}

export interface MonnifySupportResult {
  /** False on a platform with no Monnify implementation compiled in. */
  supported: boolean;
  platform: string;
  /** True once `configure()` has been accepted on this platform. */
  configured: boolean;
}

export interface MonnifyPlugin {
  /**
   * Applies merchant credentials. Call once before the first `charge()`;
   * calling again replaces them (used when switching TEST/LIVE).
   */
  configure(options: MonnifyConfiguration): Promise<void>;

  /**
   * Opens Monnify's checkout for a single transaction and resolves when the
   * sheet closes. Rejects only when the charge could not be *started*
   * (not configured, no activity, bad request) — a customer who cancels or a
   * payment that fails resolves with the corresponding `status`.
   */
  charge(request: MonnifyChargeRequest): Promise<MonnifyChargeResult>;

  isSupported(): Promise<MonnifySupportResult>;
}
