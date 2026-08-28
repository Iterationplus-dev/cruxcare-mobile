import { describe, expect, it } from 'vitest';
import { findThreadWith } from '@/composables/useChat';
import type { ChatThread } from '@/types/care';

function thread(id: string, participantId: string): ChatThread {
  return {
    id,
    participantId,
    participantName: `Person ${participantId}`,
    participantAvatarUrl: null,
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
    muted: false,
    status: 'open',
    closesAt: null,
    closedReason: null,
  };
}

describe('findThreadWith', () => {
  const threads = [thread('thread-1', 'user-1'), thread('thread-2', 'user-2')];

  it('finds the thread shared with that person', () => {
    expect(findThreadWith(threads, 'user-2')?.id).toBe('thread-2');
  });

  it('returns undefined when no thread is open with them', () => {
    expect(findThreadWith(threads, 'user-99')).toBeUndefined();
  });

  it('returns undefined before the thread list has loaded', () => {
    expect(findThreadWith(undefined, 'user-1')).toBeUndefined();
  });

  it('returns undefined when the participant is not known yet', () => {
    // The case file may still be loading, so the id is legitimately absent.
    expect(findThreadWith(threads, undefined)).toBeUndefined();
  });

  it('does not match a different person on an otherwise valid thread', () => {
    expect(findThreadWith([thread('thread-3', 'user-3')], 'user-1')).toBeUndefined();
  });
});
