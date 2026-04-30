/**
 * get_user_skills 工具 - 获取用户技能画像
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";
import { getOrCreateSkillProfile } from "@/lib/services/skill-profile";

export const getUserSkillsTool = tool(
  async (_input: Record<string, never>, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    const profile = await getOrCreateSkillProfile(userId, client);
    return JSON.stringify(profile);
  },
  {
    name: "get_user_skills",
    description:
      "获取用户的技能画像，包括各学科知识水平、学习风格偏好、学习目标、强势领域和学习偏好设置。当需要个性化回答、了解用户学习偏好或调整回答风格时使用。",
    schema: z.object({}),
  }
);
