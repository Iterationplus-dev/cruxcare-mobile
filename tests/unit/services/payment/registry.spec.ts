import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentGatewayConfig, PaymentProviderId } from '@/types/payments';
import type { PaymentProvider, PaymentRequest, PaymentResult } from '@/services/payment/PaymentProvider';

/** Stands in for a real adapter — resolution is what is under test, not any SDK. */
function fakeProvider(id: PaymentProviderId): PaymentProvider {
  return {
    id,
    collectPayment: async (request: PaymentRequest): Promise<PaymentResult> => ({
      outcome: 'authorized',
      gatewayReference: 'ref',
      reference: request.reference,
      message: null,
    }),
  };
}

function gateway(provider: PaymentProviderId): PaymentGatewayConfig {
  return { provider, apiKey: 'MK_TEST', contractCode: '123', mode: 'TEST' };
}

/** Fresh module per test: the registry is deliberately module-level state. */
async function loadRegistry() {
  vi.resetModules();
  return import('@/services/payment/registry');
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_API_MOCKS', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolvePaymentProvider', () => {
  it('opens the gateway the server named on the intent', async () => {
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('monnify'));
    registry.registerPaymentProvider(fakeProvider('mock'));
    registry.setFallbackPaymentProvider('mock');

    // The server's choice wins over the build's default.
    expect(registry.resolvePaymentProvider(gateway('monnify')).id).toBe('monnify');
  });

  it('falls back to the configured provider when the intent names none', async () => {
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('monnify'));
    registry.setFallbackPaymentProvider('monnify');

    expect(registry.resolvePaymentProvider(null).id).toBe('monnify');
  });

  it('refuses to substitute another gateway for one it cannot drive', async () => {
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('mock'));
    registry.setFallbackPaymentProvider('mock');

    // A reference minted by one gateway cannot be settled by another, so
    // falling back here would charge into an account nobody is watching.
    expect(() => registry.resolvePaymentProvider(gateway('paystack' as PaymentProviderId))).toThrow(
      registry.PaymentUnavailableError,
    );
  });

  it('throws when the build registered nothing usable', async () => {
    const registry = await loadRegistry();
    expect(() => registry.resolvePaymentProvider(null)).toThrow(registry.PaymentUnavailableError);
  });

  it('refuses the mock provider when the app is talking to a real API', async () => {
    vi.stubEnv('VITE_USE_API_MOCKS', 'false');
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('mock'));
    registry.setFallbackPaymentProvider('mock');

    // The mock approves without opening a sheet; against a real API that
    // records a payment that never happened.
    expect(() => registry.resolvePaymentProvider(null)).toThrow(/no payment gateway is configured/i);
  });

  it('allows the mock provider while the API itself is mocked', async () => {
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('mock'));
    registry.setFallbackPaymentProvider('mock');

    expect(registry.resolvePaymentProvider(null).id).toBe('mock');
  });

  it('lists what this build can drive', async () => {
    const registry = await loadRegistry();
    registry.registerPaymentProvider(fakeProvider('monnify'));
    registry.registerPaymentProvider(fakeProvider('mock'));

    expect(registry.registeredPaymentProviders().sort()).toEqual(['mock', 'monnify']);
  });
});
