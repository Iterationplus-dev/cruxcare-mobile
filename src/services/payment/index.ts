import type { PaymentGatewayConfig } from '@/types/payments';
import { MockPaymentProvider, type PaymentProvider } from './PaymentProvider';
import { MonnifyPaymentProvider } from './MonnifyPaymentProvider';

export * from './PaymentProvider';
export { MonnifyPaymentProvider };

/**
 * Build-time Monnify credentials. These are a fallback only — a payment intent
 * from the API carries its own `gateway` block, which takes precedence so keys
 * can rotate without an app release. The API key and contract code are public
 * merchant identifiers; the Monnify *secret* key belongs on the server and
 * must never appear in a `VITE_` variable, which ships in the bundle.
 */
function buildTimeGateway(): PaymentGatewayConfig | null {
  const apiKey = import.meta.env.VITE_MONNIFY_API_KEY?.trim();
  const contractCode = import.meta.env.VITE_MONNIFY_CONTRACT_CODE?.trim();
  if (!apiKey || !contractCode) return null;

  return {
    provider: 'monnify',
    apiKey,
    contractCode,
    // Anything other than an explicit LIVE stays on the sandbox: an
    // unset/typo'd variable must not start moving real money.
    mode: import.meta.env.VITE_MONNIFY_MODE?.trim().toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST',
  };
}

function selectProvider(): PaymentProvider {
  const configured = import.meta.env.VITE_PAYMENT_PROVIDER?.trim().toLowerCase();
  const gateway = buildTimeGateway();

  // Selecting Monnify without credentials anywhere would fail at the moment of
  // payment; falling back here keeps a misconfigured dev build usable and is
  // visible in the console rather than silently at checkout.
  if (configured === 'monnify') {
    if (!gateway) {
      console.warn(
        'VITE_PAYMENT_PROVIDER=monnify but no VITE_MONNIFY_API_KEY/VITE_MONNIFY_CONTRACT_CODE. ' +
          'Payments will rely on the gateway block returned by /payments/intents.',
      );
    }
    return new MonnifyPaymentProvider(gateway);
  }

  return new MockPaymentProvider();
}

export const paymentProvider: PaymentProvider = selectProvider();
