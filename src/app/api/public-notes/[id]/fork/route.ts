import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";

type PublicNote = {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  content_type: string;
  summary: string | null;
  tags: string[] | null;
  subject: string | null;
  source_type: string;
  source_url: string | null;
  status: string;
  themes: unknown;
  key_points: unknown;
  structure: unknown;
  entities: unknown;
  metrics: unknown;
  tasks: unknown;
  timeline: unknown;
  mind_map: unknown;
  flashcards: unknown;
  comparisons: unknown;
  fork_count?: number | null;
};

function keyPointText(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "point" in item) {
    return String((item as { point?: string }).point || "");
  }
  return "";
}

function extractHeadings(content: string) {
  return content
    .split("\n")
    .map((line) => line.match(/^#{1,3}\s+(.+)$/)?.[1]?.trim() || "")
    .filter(Boolean);
}

function buildKnowledgePoints(source: PublicNote) {
  const keyPoints = Array.isArray(source.key_points) ? source.key_points.map(keyPointText) : [];
  const tags = Array.isArray(source.tags) ? source.tags : [];
  const headings = extractHeadings(source.content || "");

  return [...new Set([
    ...(source.subject ? [source.subject] : []),
    ...tags,
    ...keyPoints,
    ...headings,
  ].map((item) => item.trim()).filter(Boolean))].slice(0, 20);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录，请先登录后再 Fork" }, { status: 401 });
    }

    const { id } = await params;
    const client = getApiClient();

    const { data: source, error: fetchError } = await client
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .is("deleted_at", null)
      .single<PublicNote>();

    if (fetchError || !source) {
      return NextResponse.json({ error: fetchError?.message || "公开学习闭环不存在" }, { status: 404 });
    }

    if (source.user_id === user.id) {
      return NextResponse.json({ error: "不能 Fork 自己发布的学习闭环" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const knowledgePoints = buildKnowledgePoints(source);

    const { data: forkedGoal, error: goalError } = await client
      .from("learning_goals")
      .insert({
        user_id: user.id,
        title: source.subject ? `${source.subject}：${source.title}` : source.title,
        description: source.summary || `从公开学习闭环 Fork：${source.title}`,
        cognitive_level: "understand",
        status: "active",
        knowledge_points: knowledgePoints,
        daily_plan: [
          {
            day: 1,
            focus: "理解公开闭环内容",
            objective: "阅读 fork 进来的核心笔记，确认知识点边界。",
            tasks: [
              { title: "阅读核心笔记", type: "learn", minutes: 30 },
              { title: "选择一个概念做费曼复述", type: "practice", minutes: 20 },
            ],
            checkpoints: ["能说清核心概念", "能指出至少一个薄弱点"],
          },
          {
            day: 2,
            focus: "主动回忆与补弱",
            objective: "围绕相关概念生成测验或闪卡，验证掌握情况。",
            tasks: [
              { title: "生成测验", type: "quiz", minutes: 20 },
              { title: "复习薄弱概念", type: "review", minutes: 20 },
            ],
            checkpoints: ["完成一次测验", "记录需要补强的概念"],
          },
        ],
        progress: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (goalError) {
      return NextResponse.json({ error: goalError.message }, { status: 400 });
    }

    const { data: forkedNote, error: insertError } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: `${source.title}（Fork）`,
        content: source.content,
        content_type: source.content_type,
        summary: source.summary,
        tags: source.tags || [],
        subject: source.subject,
        subject_confidence: source.subject ? 1 : 0,
        subject_reason: source.subject ? "Fork 公开学习闭环时继承原学科。" : null,
        classified_at: source.subject ? now : null,
        classification_source: source.subject ? "fork" : "auto",
        source_type: source.source_type || "text",
        source_url: source.source_url,
        status: source.status || "draft",
        themes: source.themes,
        key_points: source.key_points,
        structure: source.structure,
        entities: source.entities,
        metrics: source.metrics,
        tasks: source.tasks,
        timeline: source.timeline,
        mind_map: source.mind_map,
        flashcards: source.flashcards,
        comparisons: source.comparisons,
        parent_note_id: source.id,
        is_public: false,
        fork_count: 0,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await client
      .from("notes")
      .update({ fork_count: (source.fork_count || 0) + 1 })
      .eq("id", source.id);

    return NextResponse.json({ goal: forkedGoal, note: forkedNote }, { status: 201 });
  } catch (error) {
    console.error("Error forking public learning loop:", error);
    return NextResponse.json({ error: "Fork 学习闭环失败" }, { status: 500 });
  }
}
