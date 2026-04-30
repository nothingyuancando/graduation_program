import { tool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { getApiClient } from "@/storage/database/supabase-client";

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "的",
    "了",
    "是",
    "在",
    "和",
    "帮我",
    "给我",
    "如何",
    "什么",
    "哪些",
  ]);

  return [
    ...new Set(
      text
        .replace(/[，。？！、；：""'（）\[\]{},.!?;:\s]+/g, " ")
        .split(" ")
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length >= 2 && !stopWords.has(token))
    ),
  ];
}

function scoreNote(
  note: {
    title: string;
    summary?: string | null;
    tags?: string[] | null;
    key_points?: Array<string | { point?: string }> | null;
    subject?: string | null;
  },
  keywords: string[]
) {
  if (keywords.length === 0) return 0;

  const title = (note.title || "").toLowerCase();
  const subject = (note.subject || "").toLowerCase();
  const summary = (note.summary || "").toLowerCase();
  const tags = (note.tags || []).join(" ").toLowerCase();
  const keyPoints = (note.key_points || [])
    .map((item) =>
      typeof item === "object" && item?.point ? item.point : String(item)
    )
    .join(" ")
    .toLowerCase();

  return keywords.reduce((total, keyword) => {
    let score = 0;
    if (title.includes(keyword)) score += 3;
    if (subject.includes(keyword)) score += 3;
    if (tags.includes(keyword)) score += 2;
    if (summary.includes(keyword)) score += 1;
    if (keyPoints.includes(keyword)) score += 1;
    return total + score;
  }, 0);
}

export const searchNotesTool = tool(
  async (
    input: { query: string; subject?: string; limit?: number },
    config?: RunnableConfig
  ) => {
    const userId = config?.configurable?.userId;
    const client = getApiClient();
    const limit = Math.min(input.limit || 5, 10);
    const keywords = extractKeywords(input.query);

    let query = client
      .from("notes")
      .select("id, title, summary, tags, key_points, subject, subject_confidence, updated_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (input.subject) {
      query = query.eq("subject", input.subject);
    }

    const { data: notes } = await query;

    const ranked = (notes || [])
      .map((note) => ({
        ...note,
        score: keywords.length > 0 ? scoreNote(note, keywords) : 0,
      }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.updated_at || "").localeCompare(a.updated_at || "")
      )
      .slice(0, limit)
      .map((note) => ({
        id: note.id,
        title: note.title,
        summary: note.summary,
        tags: note.tags,
        subject: note.subject,
        subjectConfidence: note.subject_confidence,
        score: note.score,
      }));

    return JSON.stringify({
      count: ranked.length,
      notes: ranked,
    });
  },
  {
    name: "search_notes",
    description:
      "根据关键词搜索用户笔记。支持按科目 subject 过滤，适合查找某门课或某个主题的笔记。",
    schema: z.object({
      query: z.string().describe("搜索关键词或描述"),
      subject: z.string().optional().describe("可选：只搜索指定科目下的笔记"),
      limit: z.number().optional().default(5).describe("返回数量上限，最大 10"),
    }),
  }
);
