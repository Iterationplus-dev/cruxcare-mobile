import type { CaseFile } from '@/types/care';

/**
 * TD4's three filters over the therapist's clients.
 *
 * The tabs are not a partition. "Needs follow-up" is a subset of "Active" —
 * TD4 shows a client with an unwritten note sitting in the Active list — so a
 * client is counted in both. "Past" is the only exclusive one.
 */
export type ClientFilter = 'active' | 'needs-follow-up' | 'past';

export const CLIENT_FILTERS: { value: ClientFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'needs-follow-up', label: 'Needs follow-up' },
  { value: 'past', label: 'Past' },
];

/** A case that has stopped running. Matches the statuses the server treats as
 *  settled, compared case-insensitively because the API capitalises them. */
const SETTLED_STATUSES = ['closed', 'rejected', 'cancelled'];

export function isPast(caseFile: Pick<CaseFile, 'status'>): boolean {
  return SETTLED_STATUSES.includes((caseFile.status ?? '').toLowerCase());
}

/**
 * "Needs follow-up", as defined by product: a client who has been scheduled for
 * a session, or who has been sent notes. Both are engagements with something
 * still to come back to — a session to prepare for, or notes to be picked up.
 *
 * A past client is never included: nothing is owed on a case that has stopped.
 *
 * Still client-side. The backend has no `relationshipState` on the payload, so
 * this is the rule until they own it, and the counts below only see the page
 * that is loaded.
 */
export function needsFollowUp(caseFile: CaseFile): boolean {
  if (isPast(caseFile)) return false;
  return !!caseFile.nextSessionAt || caseFile.notes.length > 0;
}

export function matchesFilter(caseFile: CaseFile, filter: ClientFilter): boolean {
  switch (filter) {
    case 'past':
      return isPast(caseFile);
    case 'needs-follow-up':
      return needsFollowUp(caseFile);
    case 'active':
    default:
      return !isPast(caseFile);
  }
}

/**
 * Name search. Matches on any word so "adams" finds "Sandra Adams", and a
 * client with no name yet — a fresh case file the server has not filled in —
 * is excluded rather than matching everything.
 */
export function matchesQuery(caseFile: CaseFile, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (caseFile.clientName ?? '').toLowerCase().includes(needle);
}

export function countFor(caseFiles: CaseFile[] | undefined, filter: ClientFilter): number {
  if (!caseFiles) return 0;
  return caseFiles.filter((cf) => matchesFilter(cf, filter)).length;
}

export function filterClients(
  caseFiles: CaseFile[] | undefined,
  filter: ClientFilter,
  query = '',
): CaseFile[] {
  if (!caseFiles) return [];
  return caseFiles.filter((cf) => matchesFilter(cf, filter) && matchesQuery(cf, query));
}
