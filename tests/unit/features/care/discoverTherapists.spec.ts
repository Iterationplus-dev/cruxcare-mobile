import { describe, expect, it } from 'vitest';
import {
  discoverTherapists,
  formatNextSlot,
  hasSpecialty,
  isNearby,
  matchesTherapistQuery,
  slotAbsenceLabel,
  sortTherapists,
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

describe('isNearby', () => {
  const uyo = therapist({ location: 'Uyo, Akwa Ibom, Nigeria' });

  it('matches on the same city', () => {
    expect(isNearby(uyo, { city: 'Uyo', state: 'Akwa Ibom', country: 'Nigeria' })).toBe(true);
  });

  it('falls back to the same state when the city differs', () => {
    expect(isNearby(uyo, { city: 'Eket', state: 'Akwa Ibom', country: 'Nigeria' })).toBe(true);
  });

  it('does not call the same country near', () => {
    // Two people 800km apart share a country; that is not "near me".
    expect(isNearby(uyo, { city: 'Lagos', state: 'Lagos', country: 'Nigeria' })).toBe(false);
  });

  it('ignores casing on both sides', () => {
    expect(isNearby(uyo, { city: 'uyo' })).toBe(true);
  });

  it('is false when we do not know where the client is', () => {
    expect(isNearby(uyo, null)).toBe(false);
    expect(isNearby(uyo, {})).toBe(false);
  });

  it('is false when the therapist lists no location', () => {
    expect(isNearby(therapist({ location: null }), { city: 'Uyo' })).toBe(false);
  });
});

describe('discoverTherapists with location', () => {
  const near = therapist({ id: 'near', location: 'Uyo, Akwa Ibom, Nigeria' });
  const far = therapist({ id: 'far', location: 'Lagos, Lagos, Nigeria' });
  const me = { city: 'Uyo', state: 'Akwa Ibom', country: 'Nigeria' };

  it('sorts nearby first without hiding anyone', () => {
    const rows = discoverTherapists([far, near], '', null, { address: me });

    expect(rows.map((t) => t.id)).toEqual(['near', 'far']);
  });

  it('narrows to nearby when asked', () => {
    const rows = discoverTherapists([far, near], '', null, { address: me, nearbyOnly: true });

    expect(rows.map((t) => t.id)).toEqual(['near']);
  });

  it('keeps a bookable far therapist above a fully-booked near one', () => {
    // Being seen matters more than being close.
    const bookedNear = therapist({ id: 'bookedNear', location: 'Uyo', fullyBooked: true });
    const rows = discoverTherapists([bookedNear, far], '', null, { address: me });

    expect(rows.map((t) => t.id)).toEqual(['far', 'bookedNear']);
  });

  it('returns nobody when Near me is on and the client has no address', () => {
    // The screen hides the chip in this case; the rule holds regardless.
    const rows = discoverTherapists([near, far], '', null, { address: null, nearbyOnly: true });

    expect(rows).toEqual([]);
  });
});

describe('slotAbsenceLabel', () => {
  it('says fully booked only when they actually are', () => {
    expect(slotAbsenceLabel(therapist({ fullyBooked: true }))).toBe('Fully booked');
  });

  it('does not call an empty diary fully booked', () => {
    // The state every therapist starts in — which made this the most common
    // thing the card said, and the least true.
    expect(slotAbsenceLabel(therapist({ fullyBooked: false, schedulePublished: false }))).toBe(
      'No booking hours set',
    );
  });

  it('prefers fully booked when both are true', () => {
    // At capacity is the more actionable fact: setting hours would not help.
    expect(slotAbsenceLabel(therapist({ fullyBooked: true, schedulePublished: false }))).toBe(
      'Fully booked',
    );
  });

  it('falls back rather than accusing a therapist when the server omits the field', () => {
    // An older server sends no schedulePublished. Reading that as false would
    // label every therapist on the directory as having set no hours.
    expect(slotAbsenceLabel(therapist({ fullyBooked: false }))).toBe('No slots listed');
  });

  it('says no slots listed for a published rota with nothing free', () => {
    expect(slotAbsenceLabel(therapist({ fullyBooked: false, schedulePublished: true }))).toBe(
      'No slots listed',
    );
  });
});

describe('sortTherapists', () => {
  const list = [
    therapist({ id: 'a', name: 'Zara', rating: null, nextAvailableSlot: '2026-10-21T09:00:00Z' }),
    therapist({ id: 'b', name: 'Ade', rating: 4.2, nextAvailableSlot: null }),
    therapist({ id: 'c', name: 'Mo', rating: 4.8, nextAvailableSlot: '2026-10-20T15:00:00Z' }),
  ];
  const ids = (sorted: { id: string }[]) => sorted.map((t) => t.id);

  it('keeps the given order for relevance', () => {
    expect(ids(sortTherapists(list, 'relevance'))).toEqual(['a', 'b', 'c']);
  });

  it('puts the highest rated first and the unrated last', () => {
    expect(ids(sortTherapists(list, 'rating'))).toEqual(['c', 'b', 'a']);
  });

  it('puts the soonest slot first and no slot last', () => {
    expect(ids(sortTherapists(list, 'soonest'))).toEqual(['c', 'a', 'b']);
  });

  it('sorts by name', () => {
    expect(ids(sortTherapists(list, 'name'))).toEqual(['b', 'c', 'a']);
  });

  it('does not reorder the list it was given', () => {
    sortTherapists(list, 'name');
    expect(ids(list)).toEqual(['a', 'b', 'c']);
  });
});
