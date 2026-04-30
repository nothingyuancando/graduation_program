/**
 * 对话记忆管理
 * 简单的内存存储，保留最近的消息历史用于多轮对话
 */

import { BaseMessage } from "@langchain/core/messages";

const MAX_MESSAGES = 20;

const conversationStore = new Map<string, BaseMessage[]>();

export function getConversationHistory(userId: string): BaseMessage[] {
  return conversationStore.get(userId) || [];
}

export function saveConversationHistory(
  userId: string,
  messages: BaseMessage[]
) {
  // 保留最近 MAX_MESSAGES 条消息，防止 token 溢出
  const trimmed =
    messages.length > MAX_MESSAGES
      ? messages.slice(messages.length - MAX_MESSAGES)
      : messages;
  conversationStore.set(userId, trimmed);
}

export function clearConversationHistory(userId: string) {
  conversationStore.delete(userId);
}
