import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { getApiClient } from "@/storage/database/supabase-client";

export const getSubjectOverviewTool = tool(
  async (_input: Record<string, never>, config?: RunnableConfig) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();

    const { data, error } = await client
      .from("notes")
      .select("subject, subject_confidence, updated_at")
      .eq("user_id", userId)
      .is("deleted_at", null);

    if (error) throw new Error(error.message);

    const subjects = new Map<string, { subject: string; count: number; lowConfidence: number; latestUpdatedAt: string | null }>();

    for (const note of data || []) {
      const subject = note.subject || "未分类";
      const current = subjects.get(subject) || {
        subject,
        count: 0,
        lowConfidence: 0,
        latestUpdatedAt: null,
      };
      current.count += 1;
      if (Number(note.subject_confidence || 0) < 0.75) current.lowConfidence += 1;
      if (!current.latestUpdatedAt || (note.updated_at || "") > current.latestUpdatedAt) {
        current.latestUpdatedAt = note.updated_at;
      }
      subjects.set(subject, current);
    }

    return JSON.stringify({
      subjects: [...subjects.values()].sort((a, b) => b.count - a.count),
    });
  },
  {
    name: "get_subject_overview",
    description: "获取当前用户各科目笔记数量、低置信度数量和最近更新时间。",
    schema: z.object({}),
  }
);
