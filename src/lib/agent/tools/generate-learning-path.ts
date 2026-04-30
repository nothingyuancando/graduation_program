import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { getApiClient } from "@/storage/database/supabase-client";
import { generateLearningPath } from "@/lib/services/learning-path";

export const generateLearningPathTool = tool(
  async (input: { goal: string; days?: number }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();
    const plan = await generateLearningPath(userId, input.goal, input.days || 7, client);
    return JSON.stringify(plan);
  },
  {
    name: "generate_learning_path",
    description:
      "根据用户技能画像、薄弱点、已有笔记和学习目标生成渐进式学习路径。适合用户要求学习计划、备考计划、几天内掌握某主题时使用。",
    schema: z.object({
      goal: z.string().describe("学习目标，例如：7 天掌握数据库索引优化"),
      days: z.number().optional().default(7).describe("计划天数，1-30 天"),
    }),
  }
);
