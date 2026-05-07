import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  cognitive_level?: string | null;
  knowledge_points?: string[] | null;
  daily_plan?: unknown[] | null;
  progress?: number | null;
};

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  key_points?: unknown;
  updated_at?: string | null;
};

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function keyPointText(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "point" in item) {
    return String((item as { point?: string }).point || "");
  }
  return "";
}

function noteSearchText(note: NoteRow) {
  const keyPoints = Array.isArray(note.key_points) ? note.key_points.map(keyPointText).join(" ") : "";
  return normalize([note.title, note.summary, note.subject, note.tags?.join(" "), keyPoints].filter(Boolean).join(" "));
}

function noteMatchesGoal(note: NoteRow, goal: GoalRow) {
  const text = noteSearchText(note);
  const terms = [goal.title, ...(goal.knowledge_points || [])]
    .map((term) => normalize(term))
    .filter((term) => term.length >= 2);

  return terms.some((term) => text.includes(term) || term.includes(normalize(note.subject)));
}

function planLine(item: unknown, index: number) {
  if (typeof item === "string") return `${index + 1}. ${item}`;
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    const title = record.title || record.task || record.goal || record.content || `第 ${index + 1} 步`;
    const detail = record.description || record.detail || record.note || "";
    return `${index + 1}. ${String(title)}${detail ? `：${String(detail)}` : ""}`;
  }
  return `${index + 1}. 学习任务 ${index + 1}`;
}

function buildLoopContent(goal: GoalRow, notes: NoteRow[]) {
  const points = goal.knowledge_points || [];
  const plan = Array.isArray(goal.daily_plan) ? goal.daily_plan : [];

  return [
    `# ${goal.title}`,
    "",
    "## 学习目标",
    goal.description || "这个学习闭环聚焦一个明确目标，适合 Fork 后继续补充资料、复述和测验。",
    "",
    "## 建议掌握层级",
    goal.cognitive_level || "understand",
    "",
    "## 核心知识点",
    points.length ? points.map((point) => `- ${point}`).join("\n") : "- Fork 后可以继续补充知识点",
    "",
    "## 学习计划",
    plan.length ? plan.map(planLine).join("\n") : "1. 导入资料并整理第一篇笔记\n2. 选择一个概念完成费曼复述\n3. 生成测验并根据错题补强",
    "",
    "## 参考笔记",
    notes.length
      ? notes.map((note) => `- ${note.title}${note.summary ? `：${note.summary}` : ""}`).join("\n")
      : "- 暂无参考笔记，Fork 后可以从知识摄入开始补充。",
    "",
    "## 闭环使用方式",
    "- 先补齐资料和笔记，让知识摄入有来源。",
    "- 再选择核心概念做费曼复述，暴露理解漏洞。",
    "- 通过闪卡和测验主动回忆，把薄弱点推回补强任务。",
  ].join("\n");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const client = getApiClient();

    const { data: goal, error: goalError } = await client
      .from("learning_goals")
      .select("id, title, description, cognitive_level, knowledge_points, daily_plan, progress")
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("status", "archived")
      .single();

    if (goalError || !goal) {
      return NextResponse.json({ error: goalError?.message || "学习空间不存在" }, { status: 404 });
    }

    const typedGoal = goal as GoalRow;
    const { data: allNotes, error: notesError } = await client
      .from("notes")
      .select("id, title, summary, subject, tags, key_points, updated_at")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 400 });
    }

    const relatedNotes = ((allNotes || []) as NoteRow[]).filter((note) => noteMatchesGoal(note, typedGoal)).slice(0, 8);
    const sourceUrl = `learning-goal://${typedGoal.id}`;
    const tags = Array.from(new Set(["学习闭环", ...(typedGoal.knowledge_points || []).slice(0, 6)]));
    const content = buildLoopContent(typedGoal, relatedNotes);
    const summary =
      typedGoal.description ||
      `围绕「${typedGoal.title}」组织的学习闭环，包含目标、知识点、学习计划和参考笔记。`;
    const subject = relatedNotes.find((note) => note.subject)?.subject || typedGoal.knowledge_points?.[0] || "学习闭环";
    const now = new Date().toISOString();

    const { data: existing } = await client
      .from("notes")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_url", sourceUrl)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing?.id) {
      const { data: note, error } = await client
        .from("notes")
        .update({
          title: `学习闭环：${typedGoal.title}`,
          content,
          content_type: "markdown",
          summary,
          tags,
          subject,
          source_type: "text",
          status: "processed",
          is_public: true,
          key_points: typedGoal.knowledge_points || [],
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select("id, title, is_public")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ note, shareUrl: `/share/${note.id}` });
    }

    const { data: note, error } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: `学习闭环：${typedGoal.title}`,
        content,
        content_type: "markdown",
        summary,
        tags,
        subject,
        source_type: "text",
        source_url: sourceUrl,
        status: "processed",
        is_public: true,
        key_points: typedGoal.knowledge_points || [],
        created_at: now,
        updated_at: now,
      })
      .select("id, title, is_public")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ note, shareUrl: `/share/${note.id}` }, { status: 201 });
  } catch (error) {
    console.error("Error publishing learning space:", error);
    return NextResponse.json({ error: "发布学习空间失败" }, { status: 500 });
  }
}
