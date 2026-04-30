/**
 * analyze_note 工具 - 对笔记进行 AI 深度分析
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";
import { analyzeNoteById } from "@/lib/services/note-analysis";

export const analyzeNoteTool = tool(
  async (input: { noteId: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const origin = config?.configurable?.origin || "";
    const cookie = config?.configurable?.cookie || "";
    const client = getApiClient();

    try {
      const result = await analyzeNoteById(input.noteId, {
        client,
        userId,
        origin,
        cookie,
      });
      return JSON.stringify({
        success: true,
        message: "笔记分析完成",
        data: result,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : "笔记分析失败",
      });
    }
  },
  {
    name: "analyze_note",
    description:
      "对指定笔记进行AI深度分析，提取摘要、标签、实体和知识点。当用户要求分析或重新分析某篇笔记时使用。",
    schema: z.object({
      noteId: z.string().describe("笔记ID"),
    }),
  }
);
