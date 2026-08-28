/**
 * Rules for the areas a therapist practises in. Kept out of the screen so the
 * limits are testable and stated once — the same list is what clients read on
 * the therapist's public profile, so it is edited deliberately rather than
 * typed freely into a text field.
 */

/** Offered as one-tap chips. A therapist can still write anything else. */
export const SPECIALTY_SUGGESTIONS = [
  'Physiotherapy',
  'Pain management',
  'Sports rehabilitation',
  'Nutrition therapy',
  'Massage therapy',
  'Post-surgery recovery',
  'Mobility and posture',
  'Prenatal and postnatal care',
  'Chronic illness support',
  'Stress and sleep',
  'Herbal medicine',
  'Wellness coaching',
] as const;

/** Enough to describe a practice; past this a profile stops saying anything. */
export const MAX_SPECIALTIES = 8;

export const MAX_SPECIALTY_LENGTH = 40;

/** Collapses stray whitespace so " pain  management " and "Pain management"
 *  cannot both occupy a slot. */
export function normalizeSpecialty(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isDuplicateSpecialty(current: readonly string[], candidate: string): boolean {
  const needle = normalizeSpecialty(candidate).toLowerCase();
  return current.some((s) => s.toLowerCase() === needle);
}

export type AddSpecialtyResult =
  | { ok: true; specialties: string[] }
  | { ok: false; error: string };

/**
 * Adds one area, rejecting the cases a therapist would otherwise only discover
 * after saving. Pure so the screen never has to re-derive these rules.
 */
export function addSpecialty(current: readonly string[], raw: string): AddSpecialtyResult {
  const value = normalizeSpecialty(raw);

  if (!value) return { ok: false, error: 'Type an area of specialization first.' };

  if (value.length > MAX_SPECIALTY_LENGTH) {
    return { ok: false, error: `Keep each area under ${MAX_SPECIALTY_LENGTH} characters.` };
  }

  if (isDuplicateSpecialty(current, value)) {
    return { ok: false, error: `${value} is already on your profile.` };
  }

  if (current.length >= MAX_SPECIALTIES) {
    return { ok: false, error: `You can list up to ${MAX_SPECIALTIES} areas.` };
  }

  return { ok: true, specialties: [...current, value] };
}

export function removeSpecialty(current: readonly string[], value: string): string[] {
  return current.filter((s) => s !== value);
}
