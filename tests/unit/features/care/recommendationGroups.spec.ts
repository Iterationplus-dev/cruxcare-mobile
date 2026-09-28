import { describe, expect, it } from 'vitest';
import { groupRecommendations } from '@/features/care/recommendationGroups';
import type { CaseFileRecommendation } from '@/types/care';

function line(over: Partial<CaseFileRecommendation> = {}): CaseFileRecommendation {
  return {
    id: 'rec-1',
    productId: 'prod-1',
    productName: 'Care Blood Activator',
    quantity: 1,
    unitPrice: 25,
    unitPriceMinor: 2500,
    total: 25,
    totalMinor: 2500,
    currency: 'USD',
    note: null,
    status: 'accepted',
    paidMinor: 0,
    removable: true,
    recommendedAt: '2026-09-14T10:00:00Z',
    respondedAt: null,
    ...over,
  };
}

describe('groupRecommendations', () => {
  it('returns nothing for an empty or absent list', () => {
    expect(groupRecommendations([])).toEqual([]);
    expect(groupRecommendations(undefined)).toEqual([]);
  });

  it('collapses repeats of one product and sums the quantity and total', () => {
    const [group, ...rest] = groupRecommendations([
      line({ id: 'a' }),
      line({ id: 'b' }),
      line({ id: 'c', quantity: 2, total: 50, totalMinor: 5000 }),
    ]);

    expect(rest).toHaveLength(0);
    expect(group.quantity).toBe(4);
    expect(group.totalMinor).toBe(10_000);
    // The unit price is the captured one, unchanged by the summing.
    expect(group.unitPriceMinor).toBe(2500);
    expect(group.lineIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps a pending line apart from an accepted one', () => {
    // Only accepted lines are money owed, so folding these together would show
    // a total the client does not yet owe.
    const groups = groupRecommendations([
      line({ id: 'a', status: 'accepted' }),
      line({ id: 'b', status: 'pending' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.status)).toEqual(['accepted', 'pending']);
    expect(groups.every((g) => g.quantity === 1)).toBe(true);
  });

  it('keeps two prices for one product apart', () => {
    // A price is captured when the line is created, so a reprice leaves two
    // legitimately different lines. "2 × $25" would be false about both.
    const groups = groupRecommendations([
      line({ id: 'a' }),
      line({ id: 'b', unitPrice: 30, unitPriceMinor: 3000, total: 30, totalMinor: 3000 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.unitPriceMinor).sort()).toEqual([2500, 3000]);
  });

  it('keeps different products apart', () => {
    const groups = groupRecommendations([
      line({ id: 'a' }),
      line({ id: 'b', productId: 'prod-2', productName: 'Gim Flakes' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('gathers distinct notes and drops blanks and repeats', () => {
    const [group] = groupRecommendations([
      line({ id: 'a', note: 'One spoon twice daily.' }),
      line({ id: 'b', note: '   ' }),
      line({ id: 'c', note: 'One spoon twice daily.' }),
      line({ id: 'd', note: 'Take with food.' }),
    ]);

    expect(group.notes).toEqual(['One spoon twice daily.', 'Take with food.']);
  });

  it('sums what has been paid across the group', () => {
    const [group] = groupRecommendations([
      line({ id: 'a', paidMinor: 2500 }),
      line({ id: 'b', paidMinor: 0 }),
    ]);

    expect(group.paidMinor).toBe(2500);
  });

  it('is only removable when every line in it is', () => {
    const [group] = groupRecommendations([
      line({ id: 'a', removable: true }),
      line({ id: 'b', removable: false }),
    ]);

    expect(group.removable).toBe(false);
  });

  it('treats an absent removable as removable, and an absent paidMinor as nothing', () => {
    // Both were missing from the wire for a while; a permanently dead control
    // is worse than a refusal the client can read.
    const [group] = groupRecommendations([
      line({ id: 'a', removable: undefined, paidMinor: undefined }),
    ]);

    expect(group.removable).toBe(true);
    expect(group.paidMinor).toBe(0);
  });
});
