import { describe, expect, it } from 'vitest';
import { GENDER_FILTERS, directoryIsEmpty, genderFilterEmptyMessage } from '@/features/care/engagement';

describe('directoryIsEmpty', () => {
  it('is true only when there is nothing to show and nothing filtering it', () => {
    expect(directoryIsEmpty([], null)).toBe(true);
    expect(directoryIsEmpty(undefined, null)).toBe(true);
  });

  it('is false while the directory has anyone in it', () => {
    expect(directoryIsEmpty([{}], null)).toBe(false);
    expect(directoryIsEmpty([{}], 'non-binary')).toBe(false);
  });

  it('is false for every gender filter that matched nobody', () => {
    // The regression this exists for: gender filters server-side, so the list
    // arrives empty and looks exactly like an empty directory. Treating it as
    // one took the screen's own filter controls away with it, leaving the
    // filter applied and no way to clear it.
    for (const { value } of GENDER_FILTERS) {
      expect(directoryIsEmpty([], value), `filtered by ${value}`).toBe(false);
    }
  });
});

describe('genderFilterEmptyMessage', () => {
  it('names the filter that matched nobody, for every chip offered', () => {
    for (const { value, label } of GENDER_FILTERS) {
      expect(genderFilterEmptyMessage(value)).toContain(label.toLowerCase());
    }
  });

  it('says something useful when no gender is filtered on', () => {
    expect(genderFilterEmptyMessage(null)).toBe('Try a different search or filter.');
  });
});
