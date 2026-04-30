/**
 * Agent 统一入口
 * 提供流式和非流式两种调用方式
 */

import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { buildAgentGraph } from "./graph";
import {
  getConversationHistory,
  saveConversationHistory,
} from "./memory";

export interface AgentChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentStreamEvent {
  type: "token" | "tool_start" | "tool_end" | "error";
  data: string;
}

/**
 * 流式调用学习 Agent
 * 通过 LangGraph streamEvents 实现逐 token 输出
 */
export async function* streamLearningAgent(
  messages: AgentChatMessage[],
  options: {
    userId: string;
    origin?: string;
    cookie?: string;
  }
): AsyncGenerator<AgentStreamEvent> {
  const graph = await buildAgentGraph({ userId: options.userId });

  // 加载历史对话消息
  const history = getConversationHistory(options.userId);

  // 转换当前消息为 LangChain 格式
  const currentMessages = messages.map((m) =>
    m.role === "user"
      ? new HumanMessage(m.content)
      : new AIMessage(m.content)
  );

  // 合并历史和当前消息
  const allMessages = [...history, ...currentMessages];

  const config = {
    configurable: {
      userId: options.userId,
      origin: options.origin || "",
      cookie: options.cookie || "",
    },
  };

  try {
    const stream = graph.streamEvents(
      {
        messages: allMessages,
        userId: options.userId,
        origin: options.origin || "",
        cookie: options.cookie || "",
      },
      { ...config, version: "v2" }
    );

    let finalMessages = allMessages;

    for await (const event of stream) {
      if (event.event === "on_chat_model_stream") {
        const chunk = event.data?.chunk;
        const content = chunk?.content;
        if (typeof content === "string" && content) {
          yield { type: "token", data: content };
        }
      } else if (event.event === "on_tool_start") {
        yield { type: "tool_start", data: event.name || "" };
      } else if (event.event === "on_tool_end") {
        yield { type: "tool_end", data: event.name || "" };
      } else if (event.event === "on_chain_end" && event.name === "LangGraph") {
        // 图执行完毕，保存对话历史
        const output = event.data?.output;
        if (output?.messages) {
          finalMessages = output.messages;
        }
      }
    }

    // 保存对话历史
    saveConversationHistory(options.userId, finalMessages);
  } catch (error) {
    yield {
      type: "error",
      data:
        error instanceof Error
          ? error.message
          : "Agent 处理请求时出现错误",
    };
  }
}

/**
 * 非流式调用学习 Agent（兼容旧接口）
 */
export async function runLearningAgent(
  messages: AgentChatMessage[],
  options: {
    userId: string;
    origin?: string;
    cookie?: string;
  }
): Promise<string> {
  let fullAnswer = "";

  for await (const event of streamLearningAgent(messages, options)) {
    if (event.type === "token") {
      fullAnswer += event.data;
    } else if (event.type === "error") {
      throw new Error(event.data);
    }
  }

  return fullAnswer || "抱歉，我无法生成回答，请稍后重试。";
}
