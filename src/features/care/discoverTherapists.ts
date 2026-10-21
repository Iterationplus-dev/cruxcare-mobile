import type { TherapistSummary } from '@/types/care';
import type { Address } from '@/types/user';

/**
 * CD2 · Discover therapists — searching and narrowing the directory.
 *
 * The design's chips are "Near me", "Video", "Sleep" and "Under ₦20k". Three of
 * those need data the directory does not carry: no distance, no per-therapist
 * modality, no price. Only the condition chip is real, so the chips are built
 * from the specialties actually present rather than hard-coded — which also
 * means they never offer a filter that matches nothing.
 */

/** CD2 searches "Condition, name or discipline", so the query covers both the
 *  name and what they treat rather than the name alone. */
export function matchesTherapistQuery(therapist: TherapistSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (therapist.name.toLowerCase().includes(needle)) return true;
  return therapist.specialties.some((s) => s.toLowerCase().includes(needle));
}

/**
 * Whether a therapist is in the same place as the client.
 *
 * The directory gives a therapist's location as one composed string —
 * "Uyo, Akwa Ibom, Nigeria" — and the client's address comes as parts. So this
 * matches on the parts rather than pretending to measure distance: the same
 * city is near, and failing that the same state is nearer than nothing.
 *
 * Real proximity needs coordinates on both sides and a server-side distance;
 * `latitude`/`longitude` exist on the user record but are not returned yet.
 */
export function isNearby(
  therapist: TherapistSummary,
  address: Address | null | undefined,
): boolean {
  if (!address) return false;
  const where = therapist.location?.toLowerCase();
  if (!where) return false;

  // City first: two people in the same city are near each other whatever the
  // state says. State is the fallback, and country alone is too coarse to
  // call "near", so it is not matched on.
  const city = address.city?.trim().toLowerCase();
  if (city && where.includes(city)) return true;

  const state = address.state?.trim().toLowerCase();
  return !!state && where.includes(state);
}

export function hasSpecialty(therapist: TherapistSummary, specialty: string): boolean {
  return therapist.specialties.some((s) => s.toLowerCase() === specialty.toLowerCase());
}

/**
 * The condition chips, from the specialties in the directory. Ordered by how
 * many therapists offer each, so the most useful narrowing comes first, and
 * capped so the row stays scannable.
 */
export function specialtyChips(
  therapists: TherapistSummary[] | undefined,
  limit = 6,
): { value: string; count: number }[] {
  if (!therapists) return [];

  const counts = new Map<string, { value: string; count: number }>();
  for (const t of therapists) {
    for (const raw of t.specialties) {
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { value: raw.trim(), count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

/**
 * Fully-booked therapists stay in the list rather than being hidden — the
 * design keeps them visible so someone can still see who exists — but they sort
 * below everyone bookable.
 */
export function discoverTherapists(
  therapists: TherapistSummary[] | undefined,
  query: string,
  specialty: string | null,
  options: { address?: Address | null; nearbyOnly?: boolean } = {},
): TherapistSummary[] {
  if (!therapists) return [];

  const { address, nearbyOnly = false } = options;

  return therapists
    .filter((t) => matchesTherapistQuery(t, query))
    .filter((t) => (specialty ? hasSpecialty(t, specialty) : true))
    .filter((t) => (nearbyOnly ? isNearby(t, address) : true))
    .sort((a, b) => {
      // Bookable before fully booked, then nearby before far — someone who can
      // actually be seen matters more than someone who is merely close.
      const booked = Number(a.fullyBooked) - Number(b.fullyBooked);
      if (booked !== 0) return booked;
      return Number(isNearby(b, address)) - Number(isNearby(a, address));
    });
}

/**
 * What to say on a card with no next slot.
 *
 * Three different things produce one, and they are not interchangeable
 * statements about a person. A therapist who has never set working hours has a
 * completely empty diary, so "Fully booked" is simply false about them — and it
 * is the state every therapist starts in, which made it the most common thing
 * the card said and the least true.
 *
 * `schedulePublished` is optional on the wire, so an older server that omits it
 * falls back to the fully-booked/no-slots pair rather than accusing every
 * therapist of having set no hours.
 */
export function slotAbsenceLabel(therapist: TherapistSummary): string {
  if (therapist.fullyBooked) return 'Fully booked';
  if (therapist.schedulePublished === false) return 'No booking hours set';
  return 'No slots listed';
}

/** "Today 14:00" when it is today, otherwise "Fri 10:00". Null when there is
 *  nothing to offer, which the card renders with slotAbsenceLabel instead. */
export function formatNextSlot(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const time = at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();

  if (sameDay) return `Today ${time}`;
  return `${at.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`;
}

export type TherapistSort = 'relevance' | 'rating' | 'soonest' | 'name';

export const THERAPIST_SORTS: { value: TherapistSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'soonest', label: 'Soonest available' },
  { value: 'name', label: 'Name A–Z' },
];

/**
 * Re-orders an already filtered list. `relevance` keeps discoverTherapists'
 * own order. The others leave whoever has no figure to compare — unrated, or
 * no slot to offer — at the bottom rather than mixed in, and a stable sort
 * keeps the relevance order among ties.
 */
export function sortTherapists(therapists: TherapistSummary[], sort: TherapistSort): TherapistSummary[] {
  if (sort === 'relevance') return therapists;

  const list = [...therapists];
  if (sort === 'name') {
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }

  if (sort === 'rating') {
    return list.sort((a, b) => {
      if (a.rating === null || b.rating === null) return Number(a.rating === null) - Number(b.rating === null);
      return b.rating - a.rating;
    });
  }

  const at = (t: TherapistSummary) => {
    const time = t.nextAvailableSlot ? new Date(t.nextAvailableSlot).getTime() : NaN;
    return Number.isNaN(time) ? Infinity : time;
  };
  return list.sort((a, b) => {
    const diff = at(a) - at(b);
    return Number.isNaN(diff) ? 0 : diff;
  });
}
