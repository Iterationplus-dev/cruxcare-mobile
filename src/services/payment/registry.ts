import type { PaymentGatewayConfig, PaymentProviderId } from '@/types/payments';
import type { PaymentProvider } from './PaymentProvider';

/**
 * Which SDK actually opens when a customer taps Pay.
 *
 * The server decides. `POST /payments/intents` returns a `gateway` block
 * naming the provider that minted the reference, and this resolves that name
 * to a registered adapter at the moment of payment — not at build time. Adding
 * a second gateway later is a `registerPaymentProvider` call plus an adapter;
 * no screen changes, and no release needed to switch a customer between
 * gateways the app already carries.
 */
const registry = new Map<PaymentProviderId, PaymentProvider>();
let fallbackId: PaymentProviderId | null = null;

/**
 * Shown to the customer verbatim. Separate from `ApiError` because nothing
 * reached the API — the payment could not be *started* on this device.
 */
export class PaymentUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentUnavailableError';
  }
}

export function registerPaymentProvider(provider: PaymentProvider): void {
  registry.set(provider.id, provider);
}

/** The provider used when an intent carries no gateway block of its own. */
export function setFallbackPaymentProvider(id: PaymentProviderId): void {
  fallbackId = id;
}

export function registeredPaymentProviders(): PaymentProviderId[] {
  return [...registry.keys()];
}

const usingApiMocks = () => import.meta.env.VITE_USE_API_MOCKS === 'true';

/**
 * Resolves the adapter for one payment. Throws rather than substituting a
 * different gateway: a reference minted by one provider cannot be settled by
 * another, so quietly falling back would open a sheet that charges into an
 * account the server is not watching.
 */
export function resolvePaymentProvider(gateway: PaymentGatewayConfig | null): PaymentProvider {
  const named = gateway?.provider ?? fallbackId;

  if (!named) {
    throw new PaymentUnavailableError(
      'Card payments are not set up in this build. Please contact support.',
    );
  }

  const provider = registry.get(named);
  if (!provider) {
    // The server offered a gateway this build cannot drive — an app older than
    // the backend, most likely. Updating is the honest instruction.
    throw new PaymentUnavailableError(
      'This version of the app cannot complete that payment. Please update and try again.',
    );
  }

  // The mock approves everything without opening a sheet. Against a real API
  // that is not a stub, it is a payment that never happened being recorded as
  // one — so it fails loudly instead.
  if (provider.id === 'mock' && !usingApiMocks()) {
    throw new PaymentUnavailableError(
      'No payment gateway is configured for this build, so payments cannot be taken.',
    );
  }

  return provider;
}
