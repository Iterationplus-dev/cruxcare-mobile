import { describe, expect, it } from 'vitest';
import { formatMoney, localeFor } from '@/utils/money';

describe('formatMoney', () => {
  it('renders each currency with its own symbol', () => {
    expect(formatMoney(1234.5, 'USD')).toBe('$1,234.50');
    // en-US would print "NGN 1,234.50"; the currency picks its own locale.
    expect(formatMoney(1234.5, 'NGN')).toContain('₦');
    expect(formatMoney(1234.5, 'GHS')).toContain('₵');
  });

  it('respects a currency with no minor unit', () => {
    // XAF has no subdivision, so forcing two decimals would invent precision.
    expect(formatMoney(1234.5, 'XAF')).not.toContain('.50');
  });

  it('signs an amount only when asked', () => {
    expect(formatMoney(50, 'USD', { showSign: true })).toBe('+$50.00');
    expect(formatMoney(-50, 'USD', { showSign: true })).toBe('-$50.00');
    expect(formatMoney(0, 'USD', { showSign: true })).toBe('$0.00');
    expect(formatMoney(50, 'USD')).toBe('$50.00');
  });

  it('honours an explicit locale override', () => {
    expect(formatMoney(1234.5, 'USD', { locale: 'en-NG' })).toBe('US$1,234.50');
  });

  it('falls back to a readable string rather than throwing on a bad code', () => {
    // A balance must never blank the screen because a code was malformed.
    expect(formatMoney(12, 'NOT-A-CURRENCY')).toBe('NOT-A-CURRENCY 12.00');
  });
});

describe('localeFor', () => {
  it('maps known currencies to a locale that knows their symbol', () => {
    expect(localeFor('NGN')).toBe('en-NG');
    expect(localeFor('ngn')).toBe('en-NG');
  });

  it('falls back to en-US, which prints the ISO code', () => {
    expect(localeFor('KES')).toBe('en-US');
  });
});
