import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { chatApi } from '@/api/chat.api';

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
