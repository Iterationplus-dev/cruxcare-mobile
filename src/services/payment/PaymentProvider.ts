/**
 * Payment provider is an open item (README "Open items for the build
 * team" / PRD §17.1) — Paystack/Flutterwave/Stripe unconfirmed. Code
 * against this interface; swap the implementation once a provider is
 * chosen. Card numbers never touch CruxCare servers or this app — the
 * real implementation will hand off to the provider's own hosted UI/SDK
 * and return only an opaque token.
 */
export interface PaymentProvider {
  /** Opens the provider's own UI/SDK and resolves an opaque, single-use token. */
  collectPaymentMethod(): Promise<{ token: string; label: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  async collectPaymentMethod(): Promise<{ token: string; label: string }> {
    // Stands in for a hosted card sheet — no card data is collected or stored here.
    await new Promise((r) => setTimeout(r, 300));
    return { token: `mock-pay-${crypto.randomUUID()}`, label: 'CruxCare wallet' };
  }
}

export const paymentProvider: PaymentProvider = new MockPaymentProvider();
