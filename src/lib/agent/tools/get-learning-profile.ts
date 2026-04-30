/**
 * get_learning_profile 工具 - 获取用户学习画像
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";

export const getLearningProfileTool = tool(
  async (_input: Record<string, never>, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    const profile = await getOrCreateLearningProfile(userId, { client });
    return JSON.stringify(profile);
  },
  {
    name: "get_learning_profile",
    description:
      "获取用户的学习画像，包括薄弱概念、强势概念、兴趣领域和学习统计数据。当用户询问学习情况、薄弱点、复习建议时使用。",
    schema: z.object({}),
  }
);
