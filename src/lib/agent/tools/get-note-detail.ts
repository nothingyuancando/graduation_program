/**
 * get_note_detail 工具 - 获取笔记完整内容
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";

export const getNoteDetailTool = tool(
  async (input: { noteId: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    const { data: note, error } = await client
      .from("notes")
      .select(
        "id, title, content, summary, tags, key_points, status, updated_at"
      )
      .eq("id", input.noteId)
      .eq("user_id", userId)
      .single();

    if (error || !note) {
      return JSON.stringify({ error: "笔记未找到或无权访问" });
    }

    return JSON.stringify(note);
  },
  {
    name: "get_note_detail",
    description:
      "获取指定笔记的完整内容。当需要查看笔记详情、内容时使用。需要先通过 search_notes 获取笔记 ID。",
    schema: z.object({
      noteId: z.string().describe("笔记ID"),
    }),
  }
);
