import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { chatApi } from '@/api/chat.api';
import type { ChatThread } from '@/types/care';

/**
 * The thread shared with one other person, or undefined when none is open.
 *
 * A thread cannot be opened from the client — the server creates it with the
 * working relationship — so callers have to handle its absence rather than
 * assume one exists.
 */
export function findThreadWith(
  threads: ChatThread[] | undefined,
  participantId: string | undefined,
): ChatThread | undefined {
  if (!threads || !participantId) return undefined;
  return threads.find((t) => t.participantId === participantId);
}

/** How often unread counts are re-read while the app is open. There is no
 *  realtime channel yet, and push only refreshes them when it is delivered. */
export const CHAT_THREADS_POLL_MS = 30_000;

/**
 * The thread list carries every unread count. It polls because nothing else
 * reliably tells the app a message arrived: Ionic keeps screens alive, so a
 * dashboard read once at sign-in otherwise shows that number for good.
 */
export function useChatThreads() {
  return useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => chatApi.listThreads(),
    refetchInterval: CHAT_THREADS_POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useChatMessages(threadId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['chat', 'threads', threadId, 'messages'],
    queryFn: async () => {
      const page = await chatApi.getMessages(threadId);
      // Reading the messages is what marks them read server-side, so the
      // counts held for the thread list are now too high. `exact`, because
      // this query's own key starts with the list's and a prefix match would
      // refetch it again, forever.
      void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'], exact: true });
      return page;
    },
  });
}

export function useSendMessage(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => chatApi.sendMessage(threadId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads', threadId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });
}
