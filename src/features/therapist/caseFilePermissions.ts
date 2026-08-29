import type { CaseFile } from '@/types/care';

/**
 * A case that is no longer running is read-only for its therapist — the server
 * answers a write on one with a 404, the same as any other write they may not
 * make. Staff can still correct a finished record; therapists cannot.
 */
const SETTLED_STATUSES = ['closed', 'rejected', 'cancelled'];

export function canEditDiagnosis(caseFile: Pick<CaseFile, 'status'> | undefined): boolean {
  if (!caseFile) return false;
  // The server capitalises this ("Active"), so compare case-insensitively
  // rather than trusting either side's casing.
  const status = (caseFile.status ?? '').toLowerCase();
  if (!status) return true;
  return !SETTLED_STATUSES.includes(status);
}
