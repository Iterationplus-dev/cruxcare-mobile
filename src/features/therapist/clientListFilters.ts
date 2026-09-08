import type { ClientRelationshipState } from '@/types/care';

/**
 * TD4's three tabs.
 *
 * The classification and the counts are the server's: it decides
 * `relationshipState` and returns totals over every accessible row. A count
 * derived from one cursor page would be a false statement, and filtering in the
 * browser would only ever search the page that happened to load.
 *
 * The tabs are not a partition — "needs follow-up" is a subset of active, which
 * is why the counts do not sum to the client total.
 */
export const CLIENT_FILTERS: { value: ClientRelationshipState; label: string; countKey: 'active' | 'needsFollowUp' | 'past' }[] = [
  { value: 'active', label: 'Active', countKey: 'active' },
  { value: 'needs-follow-up', label: 'Needs follow-up', countKey: 'needsFollowUp' },
  { value: 'past', label: 'Past', countKey: 'past' },
];

export type ClientFilter = ClientRelationshipState;
