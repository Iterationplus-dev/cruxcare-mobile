import { describe, expect, it } from 'vitest';
import { CLIENT_FILTERS } from '@/features/therapist/clientListFilters';

/**
 * The classification and the counts moved to the server, so what is left to
 * guard is that the tabs ask for the states it actually returns, and read the
 * count keys it actually sends. Getting either wrong renders a silent zero.
 */
describe('CLIENT_FILTERS', () => {
  it('asks for the states the server classifies by', () => {
    expect(CLIENT_FILTERS.map((f) => f.value)).toEqual(['active', 'needs-follow-up', 'past']);
  });

  it('reads the count keys the server sends', () => {
    // meta.counts is { active, needsFollowUp, past } — note the camelCase,
    // which does not match the hyphenated state value.
    expect(CLIENT_FILTERS.map((f) => f.countKey)).toEqual(['active', 'needsFollowUp', 'past']);
  });

  it('labels them as the design does', () => {
    expect(CLIENT_FILTERS.map((f) => f.label)).toEqual(['Active', 'Needs follow-up', 'Past']);
  });
});
