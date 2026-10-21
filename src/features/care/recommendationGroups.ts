import type { CaseFileRecommendation, RecommendationStatus } from '@/types/care';

/**
 * Recommended products, collapsed for display.
 *
 * A therapist who recommends the same product twice creates two server-side
 * lines, each with its own id — and the client should not be shown the same
 * product twice with the same price beside it. One row, quantities summed.
 *
 * The lines behind a row are kept, because every action is still per line:
 * accepting a row accepts each pending line in it, and the ids are what the
 * server is told about.
 */
export interface RecommendationGroup {
  /** Stable across reorders; `productId` alone is not unique across groups. */
  key: string;
  productId: string;
  productName: string;
  /** Summed across the lines in this group. */
  quantity: number;
  unitPrice: number;
  unitPriceMinor: number;
  /** Summed from the server's own line totals, never recomputed. */
  total: number;
  totalMinor: number;
  currency: string;
  status: RecommendationStatus;
  paidMinor: number;
  /** Distinct dosing notes across the grouped lines. Usually none or one. */
  notes: string[];
  /** False when any line in the group is not removable. */
  removable: boolean;
  lineIds: string[];
}

/**
 * Two lines only merge when merging cannot misstate anything.
 *
 * Status is part of the key because only accepted lines are money owed:
 * folding a pending line into an accepted one would show a client a total they
 * do not yet owe. Unit price is part of it because a price is captured when
 * the line is created, so two lines for one product can legitimately carry
 * different prices after a reprice — and "3 × $25" would then be false about
 * both of them.
 */
function groupKey(line: CaseFileRecommendation): string {
  return `${line.productId}::${line.status}::${line.unitPriceMinor}`;
}

export function groupRecommendations(
  lines: CaseFileRecommendation[] | undefined,
): RecommendationGroup[] {
  if (!lines?.length) return [];

  const groups = new Map<string, RecommendationGroup>();

  for (const line of lines) {
    const key = groupKey(line);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitPriceMinor: line.unitPriceMinor,
        total: line.total,
        totalMinor: line.totalMinor,
        currency: line.currency,
        status: line.status,
        paidMinor: line.paidMinor ?? 0,
        notes: line.note?.trim() ? [line.note.trim()] : [],
        // Absent reads as removable — the server refuses what it must, and a
        // permanently dead control is worse than a readable refusal.
        removable: line.removable !== false,
        lineIds: [line.id],
      });
      continue;
    }

    existing.quantity += line.quantity;
    existing.totalMinor += line.totalMinor;
    existing.total += line.total;
    existing.paidMinor += line.paidMinor ?? 0;
    existing.removable = existing.removable && line.removable !== false;
    existing.lineIds.push(line.id);

    const note = line.note?.trim();
    if (note && !existing.notes.includes(note)) existing.notes.push(note);
  }

  return [...groups.values()];
}
