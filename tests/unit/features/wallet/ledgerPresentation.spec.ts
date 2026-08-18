import { describe, expect, it } from 'vitest';
import { ledgerIconForType } from '@/features/wallet/ledgerPresentation';
import type { TransactionTypeLike } from '@/types/wallet';

describe('ledger presentation', () => {
  it.each([
    ['deposit', 'account_balance_wallet'],
    ['refund', 'undo'],
    ['adjustment', 'tune'],
  ] as const)('uses a dedicated icon for %s', (type, icon) => {
    expect(ledgerIconForType(type)).toBe(icon);
  });

  it('accepts an API type introduced after this app release and uses the generic icon', () => {
    const futureApiType: TransactionTypeLike = 'future-ledger-type';

    expect(ledgerIconForType(futureApiType)).toBe('receipt_long');
  });
});
