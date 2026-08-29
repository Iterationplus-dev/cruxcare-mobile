import type { TherapistSummary } from '@/types/care';

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
): TherapistSummary[] {
  if (!therapists) return [];

  return therapists
    .filter((t) => matchesTherapistQuery(t, query))
    .filter((t) => (specialty ? hasSpecialty(t, specialty) : true))
    .sort((a, b) => Number(a.fullyBooked) - Number(b.fullyBooked));
}

/** "Today 14:00" when it is today, otherwise "Fri 10:00". Null when there is
 *  nothing to offer, which the card renders as fully booked instead. */
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
