import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { ChatMessage, ChatThread } from '@/types/care';

export const chatApi = {
  async listThreads(): Promise<ChatThread[]> {
    const { data } = await apiClient.get<ChatThread[]>('/chat/threads');
    return data;
  },

  async getMessages(threadId: string, cursor?: string): Promise<CursorPage<ChatMessage>> {
    const { data } = await apiClient.get<CursorPage<ChatMessage>>(
      `/chat/threads/${threadId}/messages`,
      { params: { cursor } },
    );
    return data;
  },

  async sendMessage(threadId: string, body: string): Promise<ChatMessage> {
    const { data } = await apiClient.post<ChatMessage>(`/chat/threads/${threadId}/messages`, {
      body,
    });
    return data;
  },
};
