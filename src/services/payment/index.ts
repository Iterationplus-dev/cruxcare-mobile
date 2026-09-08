import type { PaymentGatewayConfig, PaymentProviderId } from '@/types/payments';
import { MockPaymentProvider, type PaymentProvider } from './PaymentProvider';
import { MonnifyPaymentProvider } from './MonnifyPaymentProvider';
import {
  registerPaymentProvider,
  resolvePaymentProvider,
  setFallbackPaymentProvider,
} from './registry';

export * from './PaymentProvider';
export * from './registry';
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

/**
 * Every gateway the app can drive is registered here, whether or not this
 * build is configured to use it — the server picks per payment, and a customer
 * moved to a different gateway must not need an app update. A gateway that is
 * not registered is a compile-time absence, and `resolvePaymentProvider` says
 * so rather than substituting another.
 */
function registerProviders(): PaymentProviderId {
  const gateway = buildTimeGateway();
  registerPaymentProvider(new MonnifyPaymentProvider(gateway));
  registerPaymentProvider(new MockPaymentProvider());

  const configured = import.meta.env.VITE_PAYMENT_PROVIDER?.trim().toLowerCase();

  // Selecting Monnify without credentials anywhere would fail at the moment of
  // payment; warning here is visible in the console rather than silently at
  // checkout, and the server's own gateway block usually supplies them.
  if (configured === 'monnify' && !gateway) {
    console.warn(
      'VITE_PAYMENT_PROVIDER=monnify but no VITE_MONNIFY_API_KEY/VITE_MONNIFY_CONTRACT_CODE. ' +
        'Payments will rely on the gateway block returned by /payments/intents.',
    );
  }

  return configured === 'monnify' ? 'monnify' : 'mock';
}

setFallbackPaymentProvider(registerProviders());

/**
 * The fallback adapter, for callers with no intent in hand. Anything opening a
 * real payment should use `resolvePaymentProvider(intent.gateway)` instead, so
 * the server decides which SDK appears.
 */
export const paymentProvider: PaymentProvider = resolvePaymentProviderSafely();

function resolvePaymentProviderSafely(): PaymentProvider {
  try {
    return resolvePaymentProvider(null);
  } catch {
    // A build with no usable gateway still has to import cleanly; the error
    // belongs at the moment of payment, not at module load.
    return new MockPaymentProvider();
  }
}
