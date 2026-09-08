import { describe, expect, it } from 'vitest';
import {
  MAX_SPECIALTIES,
  addSpecialty,
  isDuplicateSpecialty,
  normalizeSpecialty,
  removeSpecialty,
} from '@/features/therapist/specialties';

describe('normalizeSpecialty', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSpecialty('  Pain   management ')).toBe('Pain management');
  });
});

describe('addSpecialty', () => {
  it('appends a valid area', () => {
    const result = addSpecialty(['Physiotherapy'], 'Massage therapy');

    expect(result).toEqual({ ok: true, specialties: ['Physiotherapy', 'Massage therapy'] });
  });

  it('stores the normalized form rather than what was typed', () => {
    const result = addSpecialty([], '  Sports   rehabilitation  ');

    expect(result).toEqual({ ok: true, specialties: ['Sports rehabilitation'] });
  });

  it('rejects an empty entry', () => {
    expect(addSpecialty([], '   ')).toMatchObject({ ok: false });
  });

  it('rejects a duplicate regardless of case or spacing', () => {
    const result = addSpecialty(['Pain management'], 'pain   MANAGEMENT');

    expect(result).toMatchObject({ ok: false });
  });

  it('rejects an entry longer than the limit', () => {
    expect(addSpecialty([], 'x'.repeat(41))).toMatchObject({ ok: false });
  });

  it('refuses to go past the maximum', () => {
    const full = Array.from({ length: MAX_SPECIALTIES }, (_, i) => `Area ${i}`);

    expect(addSpecialty(full, 'One more')).toMatchObject({ ok: false });
  });

  it('reports the duplicate before the limit, so the message is the useful one', () => {
    const full = Array.from({ length: MAX_SPECIALTIES }, (_, i) => `Area ${i}`);
    const result = addSpecialty(full, 'Area 0');

    expect(result).toMatchObject({ ok: false, error: 'Area 0 is already on your profile.' });
  });

  it('leaves the original list untouched', () => {
    const original = ['Physiotherapy'];
    addSpecialty(original, 'Nutrition therapy');

    expect(original).toEqual(['Physiotherapy']);
  });
});

describe('removeSpecialty', () => {
  it('drops only the named area', () => {
    expect(removeSpecialty(['A', 'B', 'C'], 'B')).toEqual(['A', 'C']);
  });
});

describe('isDuplicateSpecialty', () => {
  it('matches case-insensitively', () => {
    expect(isDuplicateSpecialty(['Physiotherapy'], 'physiotherapy')).toBe(true);
    expect(isDuplicateSpecialty(['Physiotherapy'], 'Nutrition therapy')).toBe(false);
  });
});
