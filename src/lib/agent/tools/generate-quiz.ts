/**
 * generate_quiz 工具 - 根据笔记内容生成练习题
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";
import { generateQuizForNote } from "@/lib/services/quiz-generation";

export const generateQuizTool = tool(
  async (input: { noteId: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    try {
      const quiz = await generateQuizForNote(input.noteId, userId, {
        client,
      });
      return JSON.stringify({
        success: true,
        message: `已生成测验《${quiz.title}》`,
        data: {
          id: quiz.id,
          title: quiz.title,
          questionCount: quiz.question_count,
        },
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : "测验生成失败",
      });
    }
  },
  {
    name: "generate_quiz",
    description:
      "根据指定笔记的内容生成练习题（选择题、填空题、简答题）。当用户要求出题、测验、练习时使用。需要先获取笔记ID。",
    schema: z.object({
      noteId: z.string().describe("笔记ID"),
    }),
  }
);
