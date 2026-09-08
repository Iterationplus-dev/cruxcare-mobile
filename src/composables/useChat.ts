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

export function useChatThreads() {
  return useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => chatApi.listThreads(),
  });
}

export function useChatMessages(threadId: string) {
  return useQuery({
    queryKey: ['chat', 'threads', threadId, 'messages'],
    queryFn: () => chatApi.getMessages(threadId),
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
