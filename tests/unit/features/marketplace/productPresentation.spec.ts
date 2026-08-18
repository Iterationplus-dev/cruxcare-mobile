import { describe, expect, it } from 'vitest';
import { formatProductTitle } from '@/features/marketplace/productPresentation';

describe('formatProductTitle', () => {
  it('normalizes whitespace and legacy uppercase names for display', () => {
    expect(formatProductTitle('  CARE BLOOD ACTIVATOR  ')).toBe('Care Blood Activator');
  });

  it('keeps minor connecting words lowercased away from the edges', () => {
    expect(formatProductTitle('flair for more details given to partner')).toBe('Flair for More Details Given to Partner');
  });

  it('returns an empty string for an empty name', () => {
    expect(formatProductTitle('   ')).toBe('');
  });
});
