import { describe, expect, it } from 'vitest';
import { canEditDiagnosis } from '@/features/therapist/caseFilePermissions';

describe('canEditDiagnosis', () => {
  it('allows editing on a running case', () => {
    expect(canEditDiagnosis({ status: 'active' })).toBe(true);
  });

  it('matches the server casing, which capitalises', () => {
    // The API returns "Active", not "active".
    expect(canEditDiagnosis({ status: 'Active' })).toBe(true);
    expect(canEditDiagnosis({ status: 'Closed' })).toBe(false);
  });

  it('refuses a settled case, where the server answers a write with 404', () => {
    expect(canEditDiagnosis({ status: 'closed' })).toBe(false);
    expect(canEditDiagnosis({ status: 'rejected' })).toBe(false);
    expect(canEditDiagnosis({ status: 'cancelled' })).toBe(false);
  });

  it('allows editing on a new case that has not started', () => {
    expect(canEditDiagnosis({ status: 'new' })).toBe(true);
  });

  it('allows editing when the status is absent rather than hiding the field', () => {
    // Older payloads may omit it; refusing would strip a therapist of a
    // capability they have, which is worse than offering one the server refuses.
    expect(canEditDiagnosis({ status: null })).toBe(true);
    expect(canEditDiagnosis({})).toBe(true);
  });

  it('refuses when there is no case file at all', () => {
    expect(canEditDiagnosis(undefined)).toBe(false);
  });

  it('allows an unknown status rather than guessing it is settled', () => {
    expect(canEditDiagnosis({ status: 'escalated' })).toBe(true);
  });
});
