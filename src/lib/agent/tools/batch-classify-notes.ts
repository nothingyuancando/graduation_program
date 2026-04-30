import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { getApiClient } from "@/storage/database/supabase-client";
import { classifyAndUpdateNote } from "@/lib/services/subject-classification";

interface BatchClassificationItem {
  noteId: string;
  title: string;
  classification: {
    confidence?: number;
    error?: string;
  };
}

export const batchClassifyNotesTool = tool(
  async (
    input: { mode?: "unclassified" | "low_confidence" | "all"; limit?: number },
    config?: RunnableConfig
  ) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();
    const limit = Math.min(input.limit || 20, 50);
    const mode = input.mode || "unclassified";

    let query = client
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (mode === "unclassified") {
      query = query.or("subject.is.null,subject.eq.未分类");
    } else if (mode === "low_confidence") {
      query = query.lt("subject_confidence", 0.75);
    }

    const { data: notes, error } = await query;
    if (error) throw new Error(error.message);

    const results: BatchClassificationItem[] = [];
    for (const note of notes || []) {
      const classification = await classifyAndUpdateNote(note, {
        client,
        userId,
        force: mode !== "unclassified",
        intent: "batch_classify_notes",
      }).catch((classificationError) => ({
        error: classificationError instanceof Error ? classificationError.message : String(classificationError),
      }));

      results.push({
        noteId: note.id,
        title: note.title,
        classification,
      });
    }

    const pending = results.filter((item) => {
      const confidence = item.classification?.confidence ?? 0;
      return confidence > 0 && confidence < 0.75;
    }).length;

    return JSON.stringify({
      mode,
      total: results.length,
      pending,
      results,
    });
  },
  {
    name: "batch_classify_notes",
    description: "批量把当前用户的未分类、低置信度或全部笔记按科目自动归类。",
    schema: z.object({
      mode: z.enum(["unclassified", "low_confidence", "all"]).optional().default("unclassified"),
      limit: z.number().optional().default(20).describe("本次最多处理多少篇，最大 50"),
    }),
  }
);
