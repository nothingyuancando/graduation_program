/**
 * get_related_notes 工具 - 获取相关笔记推荐
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";
import { getApiClient } from "@/storage/database/supabase-client";

type RelatedNoteRow = {
  id: string;
  title: string;
  tags?: string[] | null;
  summary?: string | null;
  updated_at?: string | null;
};

export const getRelatedNotesTool = tool(
  async (input: { noteId: string }, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    const { data: relationships } = await client
      .from("note_relationships")
      .select("to_note_id, confidence")
      .eq("from_note_id", input.noteId)
      .eq("relationship_type", "similar")
      .order("confidence", { ascending: false })
      .limit(10);

    const noteIds = (relationships || []).map((item) => item.to_note_id);
    const { data: notes } = noteIds.length
      ? await client
          .from("notes")
          .select("id, title, tags, summary, updated_at")
          .in("id", noteIds)
          .eq("user_id", userId)
          .is("deleted_at", null)
      : { data: [] as RelatedNoteRow[] };

    const related = (notes || [])
      .map((note) => ({
        ...note,
        similarity: Number(
          relationships?.find((item) => item.to_note_id === note.id)
            ?.confidence || 0
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return JSON.stringify({
      count: related.length,
      notes: related,
    });
  },
  {
    name: "get_related_notes",
    description:
      "获取与指定笔记相关的其他笔记（基于知识图谱）。用于发现笔记之间的关联。",
    schema: z.object({
      noteId: z.string().describe("笔记ID"),
    }),
  }
);
