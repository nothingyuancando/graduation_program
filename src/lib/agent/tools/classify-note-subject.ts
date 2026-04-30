import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { classifyNoteById } from "@/lib/services/subject-classification";
import { getApiClient } from "@/storage/database/supabase-client";

export const classifyNoteSubjectTool = tool(
  async (
    input: { noteId: string; force?: boolean },
    config?: RunnableConfig
  ) => {
    const userId = config?.configurable?.userId;
    const classification = await classifyNoteById(input.noteId, {
      client: getApiClient(),
      userId,
      force: input.force ?? true,
    });

    return JSON.stringify({ classification });
  },
  {
    name: "classify_note_subject",
    description: "对指定笔记进行科目自动分类，并把分类结果写回 notes 表。",
    schema: z.object({
      noteId: z.string().describe("要分类的笔记 ID"),
      force: z.boolean().optional().default(true).describe("是否覆盖已有自动分类；不会覆盖手动分类，除非服务端允许"),
    }),
  }
);
