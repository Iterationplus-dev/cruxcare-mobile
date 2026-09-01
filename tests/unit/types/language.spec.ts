import { describe, expect, it } from 'vitest';
import { languageLabel, languageOptions } from '@/types/user';

describe('languageLabel', () => {
  it('translates a stored tag into a name', () => {
    // The column stores `ig`, not "Igbo": the name is a translation of the tag
    // and belongs in the client.
    expect(languageLabel('ig')).toBe('Igbo');
  });

  it('falls back to a tag this build does not know', () => {
    // A blank would read as no language set, which is a different fact from a
    // language this version has not learned the name for.
    expect(languageLabel('sw')).toBe('sw');
  });

  it('is null when no language is recorded', () => {
    expect(languageLabel(null)).toBeNull();
    expect(languageLabel(undefined)).toBeNull();
    expect(languageLabel('')).toBeNull();
  });
});

describe('languageOptions', () => {
  it('offers each tag once', () => {
    expect(new Set(languageOptions.map((o) => o.value)).size).toBe(languageOptions.length);
  });

  it('uses BCP-47 tags, which is what the API validates against', () => {
    for (const option of languageOptions) {
      expect(option.value).toMatch(/^[a-z]{2,3}$/);
    }
  });
});
