import { describe, expect, it } from 'vitest';
import {
  discoverTherapists,
  formatNextSlot,
  hasSpecialty,
  matchesTherapistQuery,
  specialtyChips,
} from '@/features/care/discoverTherapists';
import type { TherapistSummary } from '@/types/care';

function therapist(overrides: Partial<TherapistSummary> = {}): TherapistSummary {
  return {
    id: 't-1',
    name: 'Dr. K. Adeyemi',
    avatarUrl: null,
    specialties: ['Naturopathy'],
    rating: 4.9,
    nextAvailableSlot: null,
    fullyBooked: false,
    ...overrides,
  };
}

describe('matchesTherapistQuery', () => {
  it('matches a name', () => {
    expect(matchesTherapistQuery(therapist(), 'adeyemi')).toBe(true);
  });

  it('matches a condition, which is what the field asks for', () => {
    // CD2's placeholder is "Condition, name or discipline" — searching only
    // names would fail the thing most people type.
    expect(matchesTherapistQuery(therapist({ specialties: ['Sleep', 'Stress'] }), 'sleep')).toBe(true);
  });

  it('does not match an unrelated term', () => {
    expect(matchesTherapistQuery(therapist(), 'physio')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesTherapistQuery(therapist(), '  ')).toBe(true);
  });
});

describe('specialtyChips', () => {
  const list = [
    therapist({ id: 'a', specialties: ['Sleep', 'Stress'] }),
    therapist({ id: 'b', specialties: ['Sleep'] }),
    therapist({ id: 'c', specialties: ['Mobility'] }),
  ];

  it('counts how many therapists offer each', () => {
    expect(specialtyChips(list)).toEqual([
      { value: 'Sleep', count: 2 },
      { value: 'Mobility', count: 1 },
      { value: 'Stress', count: 1 },
    ]);
  });

  it('never offers a chip that would match nothing', () => {
    // Chips come from the data, so every one has at least one therapist.
    expect(specialtyChips(list).every((c) => c.count > 0)).toBe(true);
  });

  it('treats differently-cased specialties as one chip', () => {
    const chips = specialtyChips([
      therapist({ id: 'a', specialties: ['Sleep'] }),
      therapist({ id: 'b', specialties: ['sleep'] }),
    ]);

    expect(chips).toHaveLength(1);
    expect(chips[0].count).toBe(2);
  });

  it('caps the row so it stays scannable', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      therapist({ id: `t${i}`, specialties: [`Area ${i}`] }),
    );

    expect(specialtyChips(many)).toHaveLength(6);
  });

  it('has nothing to offer before the directory loads', () => {
    expect(specialtyChips(undefined)).toEqual([]);
  });
});

describe('discoverTherapists', () => {
  const bookable = therapist({ id: 'free', fullyBooked: false });
  const booked = therapist({ id: 'booked', fullyBooked: true });

  it('keeps fully-booked therapists visible but below the bookable ones', () => {
    // The design deliberately keeps them in the list rather than hiding them.
    expect(discoverTherapists([booked, bookable], '', null).map((t) => t.id)).toEqual([
      'free',
      'booked',
    ]);
  });

  it('narrows by specialty', () => {
    const list = [
      therapist({ id: 'a', specialties: ['Sleep'] }),
      therapist({ id: 'b', specialties: ['Mobility'] }),
    ];

    expect(discoverTherapists(list, '', 'Sleep').map((t) => t.id)).toEqual(['a']);
  });

  it('combines the query and the chip', () => {
    const list = [
      therapist({ id: 'a', name: 'Ada', specialties: ['Sleep'] }),
      therapist({ id: 'b', name: 'Bola', specialties: ['Sleep'] }),
    ];

    expect(discoverTherapists(list, 'bola', 'Sleep').map((t) => t.id)).toEqual(['b']);
  });

  it('returns nothing before the directory loads', () => {
    expect(discoverTherapists(undefined, '', null)).toEqual([]);
  });
});

describe('hasSpecialty', () => {
  it('ignores casing', () => {
    expect(hasSpecialty(therapist({ specialties: ['Sleep'] }), 'sleep')).toBe(true);
  });
});

describe('formatNextSlot', () => {
  const now = new Date('2026-08-29T09:00:00');

  it('says today for a slot later the same day', () => {
    expect(formatNextSlot('2026-08-29T14:00:00', now)).toBe('Today 14:00');
  });

  it('names the weekday otherwise', () => {
    expect(formatNextSlot('2026-09-04T10:00:00', now)).toBe('Fri 10:00');
  });

  it('is null when there is no slot, so the card can say fully booked', () => {
    expect(formatNextSlot(null, now)).toBeNull();
  });

  it('is null rather than "Invalid Date" on an unusable value', () => {
    expect(formatNextSlot('not-a-date', now)).toBeNull();
  });
});
