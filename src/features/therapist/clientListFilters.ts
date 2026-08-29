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
 * PROVISIONAL — this rule belongs to the server, not here.
 *
 * The backend has asked which definition is intended: a client with a completed
 * session and nothing next booked, an unwritten note past some age, or a missed
 * session not yet rearranged. Until that is answered there is no
 * `relationshipState` on the payload, so this stands in.
 *
 * It deliberately covers the two the app can see honestly:
 *   - a note the therapist has not written up, which TD4 already flags in amber
 *   - a client who has been seen and has nothing booked next, who will quietly
 *     lapse if nobody looks
 *
 * When the server sends the classification, delete this and read that field.
 */
export function needsFollowUp(caseFile: CaseFile): boolean {
  if (isPast(caseFile)) return false;
  if (caseFile.unwrittenNoteFrom) return true;
  return (caseFile.sessionCount ?? 0) > 0 && !caseFile.nextSessionAt;
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

export function countFor(caseFiles: CaseFile[] | undefined, filter: ClientFilter): number {
  if (!caseFiles) return 0;
  return caseFiles.filter((cf) => matchesFilter(cf, filter)).length;
}

export function filterClients(
  caseFiles: CaseFile[] | undefined,
  filter: ClientFilter,
): CaseFile[] {
  if (!caseFiles) return [];
  return caseFiles.filter((cf) => matchesFilter(cf, filter));
}
