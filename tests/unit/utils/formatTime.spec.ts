import { describe, expect, it } from 'vitest';
import { formatClock, formatRelativeTime } from '@/utils/formatTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-08T12:00:00Z');

  it('returns "just now" for sub-minute gaps', () => {
    expect(formatRelativeTime('2026-08-08T11:59:40Z', now)).toBe('just now');
  });

  it('pluralizes minutes correctly', () => {
    expect(formatRelativeTime('2026-08-08T11:59:00Z', now)).toBe('1 minute ago');
    expect(formatRelativeTime('2026-08-08T11:55:00Z', now)).toBe('5 minutes ago');
  });

  it('switches to hours after 60 minutes', () => {
    expect(formatRelativeTime('2026-08-08T10:00:00Z', now)).toBe('2 hours ago');
  });

  it('falls back to a date beyond a day', () => {
    expect(formatRelativeTime('2026-08-01T12:00:00Z', now)).toBe('Aug 1');
  });
});

describe('formatClock', () => {
  it('formats 24-hour HH:MM', () => {
    expect(formatClock('2026-08-08T09:05:00Z')).toMatch(/^\d{2}:\d{2}$/);
  });
});
