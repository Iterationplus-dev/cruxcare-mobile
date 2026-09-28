import type { CursorPage } from '@/types/api';
import type { WithdrawalWindow } from '@/types/wallet';

/**
 * What a therapist's share was taken of.
 *
 * Only ever the treatment plan, and extensions of it. Products are goods
 * CruxCare sources, dispatches and carries the cost of, so recommending one is
 * clinical advice rather than a sale — which is the same reasoning that stops a
 * therapist putting a product on somebody's bill unilaterally. `products` is
 * therefore not a value this can hold, and a row claiming it would be a bug.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type EarningBasis = 'treatment' | 'extension' | (string & {});

/**
 * Where an earning has got to.
 *
 * `accrued` is written the moment a client payment settles, so a therapist
 * watching a deposit land sees their share at once — it is real, and it is not
 * withdrawable. It becomes `due` when the client has paid the course off,
 * because a course abandoned at 70% has not been delivered and paying out
 * against it would have CruxCare funding the gap.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type EarningStatus = 'accrued' | 'due' | (string & {});

export interface TherapistEarning {
  id: string;
  caseId: string;
  clientId: string;
  /** The client's name where the server sends one; the row still reads without it. */
  clientName?: string | null;
  basis: EarningBasis;
  /** What the share was taken of — the client's payment, not the therapist's cut. */
  baseMinor: number;
  ratePercent: number;
  grossMinor: number;
  /**
   * The split of `grossMinor`. The reserve is carved *out of* the earning
   * rather than added on top, so these two always sum to `grossMinor` exactly.
   */
  cashMinor: number;
  loyaltyMinor: number;
  currency?: string;
  status: EarningStatus;
  earnedAt: string;
  /** When it became withdrawable. Null while `accrued`. */
  releasedAt: string | null;
}

/**
 * Totals over *everything*, not over the loaded page.
 *
 * A page-derived total is a false statement about somebody's money: "due"
 * meaning "due on the rows we happened to fetch" is worse than showing no
 * figure at all.
 */
export interface EarningsSummary {
  planSlug: string;
  ratePercent: number;
  loyaltyPercent: number;
  accruedMinor: number;
  dueMinor: number;
  cashDueMinor: number;
  loyaltyDueMinor: number;
  lifetimeMinor: number;
  currency?: string;
}

export type TherapistEarningsPage = CursorPage<TherapistEarning> & {
  meta: {
    summary?: EarningsSummary;
    /** Repeated here so the earnings screen needs no second call for it. */
    withdrawalWindow?: WithdrawalWindow;
  };
};
