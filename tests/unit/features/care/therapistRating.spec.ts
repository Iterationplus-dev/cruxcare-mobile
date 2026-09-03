import { describe, expect, it } from 'vitest';
import { ratingLabel, ratingText } from '@/features/care/therapistRating';

describe('ratingText', () => {
  it('says a therapist is unrated rather than showing nothing', () => {
    // The row used to render only when a rating existed, and none ever does —
    // so the thing a client opened the profile to read was invisible.
    expect(ratingText({ rating: null })).toBe('Not rated yet');
  });

  it('shows the score with how many ratings back it', () => {
    // 4.9 from one review and 4.9 from two hundred are different claims.
    expect(ratingText({ rating: 4.9, ratingCount: 34 })).toBe('4.9 · 34 ratings');
  });

  it('reads naturally for a single rating', () => {
    expect(ratingText({ rating: 5, ratingCount: 1 })).toBe('5.0 · 1 rating');
  });

  it('rounds to one decimal the way the platform does', () => {
    // 4.85 is not exactly 4.85 in binary floating point, so toFixed gives 4.8.
    // Pinned because a score is a claim about a person and should not drift.
    expect(ratingText({ rating: 4.85, ratingCount: 2 })).toBe('4.8 · 2 ratings');
  });

  it('omits a count of zero rather than saying "0 ratings"', () => {
    expect(ratingText({ rating: 4.2, ratingCount: 0 })).toBe('4.2 rating');
  });
});

describe('ratingLabel', () => {
  it('spells the score out of five for a screen reader', () => {
    expect(ratingLabel({ rating: 4.9, ratingCount: 34 })).toBe('4.9 out of 5 from 34 ratings');
  });

  it('matches the visible text when unrated', () => {
    expect(ratingLabel({ rating: null })).toBe('Not rated yet');
  });
});
