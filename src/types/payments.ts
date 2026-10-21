/**
 * Gateway payments. The rule that shapes every type here: the device is not
 * an authority on money. It asks the API to open a payment, hands the gateway
 * SDK the reference the API minted, and then asks the API what happened. A
 * status the SDK reported on the device is only ever a hint for the UI.
 *
 * Amounts follow the rest of this API — major units as JSON numbers plus a
 * three-letter `currency` (see `MoneyQuote` in `@/types/wallet`).
 */

export type PaymentProviderId = 'monnify' | 'mock';

export type PaymentPurpose =
  | 'therapist-plan'
  | 'order'
  | 'wallet-topup'
  | 'care-plan'
  /** What a client owes for one case: treatment plus the products they
   *  accepted. The only purpose that takes a caller-specified `amount`. */
  | 'case-balance';

/**
 * Which rail the customer picked. It is a *preference*, not a guarantee: the
 * gateway decides what its sheet can actually offer, and the API records what
 * was finally used. Omitted means "let the gateway show everything it has".
 */
export type PaymentChannel = 'card' | 'bank-transfer';

export interface CreatePaymentIntentPayload {
  purpose: PaymentPurpose;
  /**
   * What is being paid for: a plan tier, a checkout quote id, an order id.
   * The server resolves it to a price; the app never sends one.
   */
  subject: string;
  /**
   * The amount currently on screen. Sent so the server can reject a stale
   * quote rather than silently charging a different figure.
   */
  expectedAmount?: number;
  expectedCurrency?: string;
  /**
   * Sent so the server can prepare the rail — a bank transfer usually needs a
   * reserved account before the sheet opens. The server may still return an
   * intent the customer completes another way.
   */
  channel?: PaymentChannel;
  /**
   * `case-balance` only: which part of the bill is being settled.
   *
   * Named rather than a free amount, so there is no way to construct a
   * part-payment the rules do not allow — the server prices the item from the
   * bill. Omitted means `everything`.
   */
  item?: CasePaymentItem;
}

/**
 * The payable pieces of a case.
 *
 * Only the treatment plan can be split, and only ever 70/30: the deposit is
 * what starts treatment, the balance falls due at the midpoint of the window.
 * Products are goods being dispatched rather than care delivered over months,
 * so they always settle in full.
 */
export type CasePaymentItem =
  | 'treatment-deposit'
  | 'treatment-balance'
  | 'treatment'
  | 'products'
  /**
   * The instalment that is due now, plus every accepted product, in one
   * charge.
   *
   * It exists because those two are what a client on instalments actually owes
   * today: the plan is split over the course, but the goods are not, so paying
   * "what I owe right now" previously meant two trips through the card sheet
   * for one decision. `everything` is still the other button — that one settles
   * the future instalment as well.
   *
   * The server resolves "due now" from the schedule, exactly as it does for the
   * named steps. The app must not work out which step that is: a device
   * deciding the balance is due before the deposit is how a plan gets paid in
   * the wrong order.
   */
  | 'due-plus-products'
  /**
   * Extra visits a therapist offered after the course started. Paid in full and
   * before they take effect — until this settles the window has not moved and
   * the sessions are not the client's to book.
   */
  | 'extensions'
  | 'everything';

/**
 * Merchant credentials for the gateway SDK. Served by the API rather than
 * compiled into the app so keys and TEST/LIVE can change without a release.
 * `apiKey`/`contractCode` are public merchant identifiers — the Monnify
 * *secret* key must never leave the server.
 */
export interface PaymentGatewayConfig {
  provider: PaymentProviderId;
  apiKey: string;
  contractCode: string;
  mode: 'TEST' | 'LIVE';
}

export interface PaymentIntent {
  /**
   * Merchant reference minted by the API. Monnify echoes it back on its
   * webhook, which is how the server ties a settlement to this intent.
   */
  reference: string;
  amount: number;
  currency: string;
  description: string;
  /** Prefilled into the gateway sheet so the customer does not retype it. */
  customerName: string;
  customerEmail: string;
  /** Null asks the app to fall back to its build-time gateway configuration. */
  gateway: PaymentGatewayConfig | null;
  expiresAt: string;
}

/** Server-authoritative outcome. `pending` is not a success. */
export type PaymentSettlementStatus = 'settled' | 'pending' | 'failed' | 'cancelled';

export interface PaymentConfirmation {
  reference: string;
  status: PaymentSettlementStatus;
  /** Safe to show the customer verbatim. */
  message: string;
  amountPaid: number | null;
  currency: string;
  settledAt: string | null;
}
