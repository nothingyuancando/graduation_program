/**
 * LangGraph Agent 状态定义
 */

import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  /** 对话消息历史 */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  /** 用户 ID */
  userId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  /** 请求来源 */
  origin: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  /** Cookie */
  cookie: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  /** 查询分类结果 */
  queryType: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "general",
  }),
  /** 当前迭代轮次 */
  iterationCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;
