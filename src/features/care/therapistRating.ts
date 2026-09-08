import type { TherapistSummary } from '@/types/care';

/**
 * How a therapist's rating reads on their profile.
 *
 * Nothing on the platform collects ratings yet — the API returns
 * `rating: null, ratingCount: 0` for everyone — so the honest job here is to
 * say that plainly rather than hide the row. A profile that silently omits its
 * rating looks broken; one that says "Not rated yet" is simply true.
 *
 * The count matters as much as the score: 4.9 from one review and 4.9 from two
 * hundred are different claims, and showing a bare number treats them alike.
 */
export function ratingText(therapist: Pick<TherapistSummary, 'rating'> & { ratingCount?: number }): string {
  if (therapist.rating === null || therapist.rating === undefined) return 'Not rated yet';

  const score = therapist.rating.toFixed(1);
  const count = therapist.ratingCount ?? 0;

  if (count <= 0) return `${score} rating`;
  return `${score} · ${count} ${count === 1 ? 'rating' : 'ratings'}`;
}

/** The same fact, spelled out for a screen reader. */
export function ratingLabel(therapist: Pick<TherapistSummary, 'rating'> & { ratingCount?: number }): string {
  if (therapist.rating === null || therapist.rating === undefined) {
    return 'Not rated yet';
  }

  const count = therapist.ratingCount ?? 0;
  const from = count > 0 ? ` from ${count} ${count === 1 ? 'rating' : 'ratings'}` : '';
  return `${therapist.rating.toFixed(1)} out of 5${from}`;
}
