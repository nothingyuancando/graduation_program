import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { buildSystemPrompt } from "./prompts";
import { formatSkillContextForPrompt } from "@/lib/services/skill-profile";
import type { AgentStateType } from "./state";

export async function routerNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const lastUserMsg = state.messages
    .filter((message) => message._getType() === "human")
    .pop();
  const content =
    typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";

  let queryType = "general";
  if (/学习路径|学习计划|学习规划|备考计划|路线图|渐进式|progressive|learning path|study plan|几天.*学|制定.*计划/i.test(content)) {
    queryType = "learning_path";
  } else if (/出题|测验|练习|quiz|考试|做题/i.test(content)) {
    queryType = "quiz";
  } else if (/分析|analyze|总结|提取|知识点/i.test(content)) {
    queryType = "analysis";
  } else if (/薄弱|学习画像|学习情况|profile|掌握|复习建议/i.test(content)) {
    queryType = "profile";
  } else if (/技能|技能画像|偏好|学习风格|学习目标|skill/i.test(content)) {
    queryType = "skills";
  } else if (/科目|学科|课程|分类|归类|未分类|按科目|subject|classify/i.test(content)) {
    queryType = "subject";
  } else if (/搜|搜索|检索|有哪些|查找|相关/i.test(content)) {
    queryType = "search";
  }

  let skillContext = "";
  if (state.userId) {
    try {
      skillContext = await formatSkillContextForPrompt(state.userId);
    } catch {
      // Skill context is optional.
    }
  }

  return {
    queryType,
    messages: [new SystemMessage(buildSystemPrompt(queryType, skillContext))],
  };
}

export function shouldContinue(state: AgentStateType): "tools" | "__end__" {
  const lastMessage = state.messages[state.messages.length - 1];

  if (
    lastMessage._getType() === "ai" &&
    (lastMessage as AIMessage).tool_calls &&
    (lastMessage as AIMessage).tool_calls!.length > 0 &&
    state.iterationCount < 6
  ) {
    return "tools";
  }

  return "__end__";
}
