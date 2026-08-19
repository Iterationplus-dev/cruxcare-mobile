import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentProvider } from '@/services/payment/PaymentProvider';

const charge = vi.fn();
const configure = vi.fn().mockResolvedValue(undefined);

vi.mock('@cruxcare/capacitor-monnify', () => ({
  Monnify: {
    charge: (...args: unknown[]) => charge(...args),
    configure: (...args: unknown[]) => configure(...args),
  },
}));

const { MonnifyPaymentProvider } = await import('@/services/payment/MonnifyPaymentProvider');

const buildTime = {
  provider: 'monnify' as const,
  apiKey: 'MK_TEST_BUILD',
  contractCode: '111',
  mode: 'TEST' as const,
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    reference: 'CCPAY-1',
    amount: 15,
    currency: 'USD',
    description: 'CruxCare monthly plan',
    customerName: 'Amaka Obi',
    customerEmail: 'amaka@cruxcare.app',
    gateway: null,
    ...overrides,
  } as never;
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    status: 'PAID',
    transactionReference: 'MNFY|123',
    paymentReference: 'CCPAY-1',
    amountPaid: 15,
    amountPayable: 15,
    currencyCode: 'USD',
    paymentMethod: 'CARD',
    paidOn: '2026-08-18T10:00:00.000Z',
    message: null,
    ...overrides,
  };
}

describe('MonnifyPaymentProvider', () => {
  beforeEach(() => {
    charge.mockReset();
    configure.mockClear();
  });

  it('reports a paid transaction as authorized and forwards the gateway reference', async () => {
    charge.mockResolvedValue(result());

    const outcome = await new MonnifyPaymentProvider(buildTime).collectPayment(request());

    expect(outcome).toMatchObject({
      outcome: 'authorized',
      gatewayReference: 'MNFY|123',
      reference: 'CCPAY-1',
    });
  });

  it('treats an overpayment as authorized so the server can reconcile the excess', async () => {
    charge.mockResolvedValue(result({ status: 'OVERPAID', amountPaid: 20 }));

    await expect(
      new MonnifyPaymentProvider(buildTime).collectPayment(request()),
    ).resolves.toMatchObject({ outcome: 'authorized' });
  });

  it.each(['PENDING', 'PARTIALLY_PAID'] as const)(
    'keeps %s pending rather than claiming a payment succeeded',
    async (status) => {
      charge.mockResolvedValue(result({ status }));

      await expect(
        new MonnifyPaymentProvider(buildTime).collectPayment(request()),
      ).resolves.toMatchObject({ outcome: 'pending' });
    },
  );

  it.each(['FAILED', 'PAYMENT_GATEWAY_ERROR'] as const)('maps %s to failed', async (status) => {
    charge.mockResolvedValue(result({ status }));

    await expect(
      new MonnifyPaymentProvider(buildTime).collectPayment(request()),
    ).resolves.toMatchObject({ outcome: 'failed' });
  });

  it('reports a dismissed sheet as cancelled with no gateway reference', async () => {
    charge.mockResolvedValue(result({ status: 'CANCELLED', transactionReference: null }));

    await expect(
      new MonnifyPaymentProvider(buildTime).collectPayment(request()),
    ).resolves.toMatchObject({ outcome: 'cancelled', gatewayReference: null });
  });

  it('never substitutes the merchant reference for a missing gateway reference', async () => {
    charge.mockResolvedValue(result({ transactionReference: '   ' }));

    const outcome = await new MonnifyPaymentProvider(buildTime).collectPayment(request());

    expect(outcome.gatewayReference).toBeNull();
  });

  it('prefers server-supplied credentials over the build-time fallback', async () => {
    charge.mockResolvedValue(result());
    const fromServer = {
      provider: 'monnify' as const,
      apiKey: 'MK_PROD_SERVER',
      contractCode: '999',
      mode: 'LIVE' as const,
    };

    await new MonnifyPaymentProvider(buildTime).collectPayment(request({ gateway: fromServer }));

    expect(configure).toHaveBeenCalledWith({
      apiKey: 'MK_PROD_SERVER',
      contractCode: '999',
      applicationMode: 'LIVE',
    });
  });

  it('reconfigures only when the credentials actually change', async () => {
    charge.mockResolvedValue(result());
    const provider = new MonnifyPaymentProvider(buildTime);

    await provider.collectPayment(request());
    await provider.collectPayment(request());
    expect(configure).toHaveBeenCalledTimes(1);

    await provider.collectPayment(
      request({ gateway: { ...buildTime, apiKey: 'MK_TEST_ROTATED' } }),
    );
    expect(configure).toHaveBeenCalledTimes(2);
  });

  it('fails loudly when no credentials exist anywhere', async () => {
    await expect(new MonnifyPaymentProvider(null).collectPayment(request())).rejects.toThrow(
      /No Monnify merchant credentials/,
    );
    expect(charge).not.toHaveBeenCalled();
  });

  it('does not advertise a vaulting flow Monnify checkout cannot provide', () => {
    // Checked through the interface, which is how callers see it: the optional
    // method has to be genuinely absent, not present-and-throwing.
    const provider: PaymentProvider = new MonnifyPaymentProvider(buildTime);

    expect(provider.collectPaymentMethod).toBeUndefined();
  });
});
