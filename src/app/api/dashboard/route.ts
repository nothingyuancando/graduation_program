import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";

type WeakConcept = {
  concept: string;
  score?: number;
  lastSeen?: string;
};

type ProfileShape = {
  weak_concepts?: WeakConcept[];
  weakConcepts?: WeakConcept[];
  strong_concepts?: WeakConcept[];
  strongConcepts?: WeakConcept[];
  interests?: string[];
  study_stats?: Record<string, unknown>;
  studyStats?: Record<string, unknown>;
};

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  status: string;
  updated_at?: string | null;
  created_at?: string | null;
};

type QuizRow = {
  note_id: string;
};

type EntityRow = {
  entity_name?: string | null;
  entity_type?: string | null;
  note_id: string;
  confidence?: string | number | null;
};

function conceptText(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "concept" in item) {
    return String((item as WeakConcept).concept || "");
  }
  return "";
}

function buildRecommendedActions(input: {
  dueReviewCount: number;
  weakConcepts: WeakConcept[];
  notesWithoutQuiz: Array<{ id: string; title: string }>;
  latestNote?: { id: string; title: string } | null;
}) {
  const actions: Array<{
    title: string;
    description: string;
    href: string;
    priority: "high" | "medium" | "normal";
    type: "review" | "quiz" | "path" | "note";
  }> = [];

  if (input.dueReviewCount > 0) {
    actions.push({
      title: `复习 ${input.dueReviewCount} 张到期卡片`,
      description: "优先处理已经到期的闪卡，维持间隔重复节奏。",
      href: "/review",
      priority: "high",
      type: "review",
    });
  }

  const topWeak = input.weakConcepts.map(conceptText).filter(Boolean)[0];
  if (topWeak) {
    actions.push({
      title: `围绕“${topWeak}”补一次短测`,
      description: "这个概念最近被系统识别为薄弱点，适合用题目确认掌握情况。",
      href: `/concepts/${encodeURIComponent(topWeak)}`,
      priority: "high",
      type: "quiz",
    });
  }

  const noteWithoutQuiz = input.notesWithoutQuiz[0];
  if (noteWithoutQuiz) {
    actions.push({
      title: "给最近笔记生成测验",
      description: `《${noteWithoutQuiz.title}》还没有测验记录，可以把静态笔记转成掌握度检测。`,
      href: `/quiz/${noteWithoutQuiz.id}`,
      priority: "medium",
      type: "quiz",
    });
  }

  if (input.weakConcepts.length >= 2) {
    actions.push({
      title: "生成一条针对薄弱点的学习路径",
      description: "把多个薄弱概念组织成连续几天可执行的复习计划。",
      href: "/learning-path",
      priority: "medium",
      type: "path",
    });
  }

  if (input.latestNote) {
    actions.push({
      title: "继续整理最近的学习资料",
      description: `从《${input.latestNote.title}》进入，检查知识点、证据和相关概念。`,
      href: `/notes/${input.latestNote.id}`,
      priority: "normal",
      type: "note",
    });
  }

  return actions.slice(0, 5);
}

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const client = getApiClient();
    const now = new Date().toISOString();

    const [
      profile,
      dueReviews,
      notesResult,
      quizzesResult,
      attemptsResult,
    ] = await Promise.all([
      getOrCreateLearningProfile(user.id, { client }),
      client
        .from("flashcard_reviews")
        .select("id, note_id, question, due_date")
        .eq("user_id", user.id)
        .lte("due_date", now)
        .limit(10),
      client
        .from("notes")
        .select("id, title, summary, subject, tags, status, updated_at, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(30),
      client.from("quizzes").select("note_id").eq("user_id", user.id),
      client
        .from("quiz_attempts")
        .select("id, quiz_id, score, total_correct, total_questions, completed_at, weak_points")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

    const notes = (notesResult.data || []) as NoteRow[];
    const quizzes = (quizzesResult.data || []) as QuizRow[];
    const quizNoteIds = new Set(quizzes.map((quiz) => quiz.note_id));
    const notesWithoutQuiz = notes
      .filter((note) => !quizNoteIds.has(note.id) && ["processed", "organized"].includes(note.status))
      .slice(0, 5);

    const noteIds = notes.map((note) => note.id);
    const conceptRowsResult = noteIds.length
      ? await client
          .from("note_entities")
          .select("entity_name, entity_type, note_id, confidence")
          .in("note_id", noteIds)
          .limit(300)
      : { data: [] as EntityRow[] };
    const conceptCounts = new Map<string, { name: string; count: number; types: Set<string> }>();
    const conceptRows = (conceptRowsResult.data || []) as EntityRow[];
    for (const row of conceptRows) {
      const name = String(row.entity_name || "").trim();
      if (!name) continue;
      const current = conceptCounts.get(name) || { name, count: 0, types: new Set<string>() };
      current.count += 1;
      current.types.add(String(row.entity_type || "concept"));
      conceptCounts.set(name, current);
    }

    const topConcepts = [...conceptCounts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 10)
      .map((item) => ({
        name: item.name,
        count: item.count,
        types: [...item.types],
      }));

    const typedProfile = profile as ProfileShape;
    const weakConcepts = typedProfile.weak_concepts || typedProfile.weakConcepts || [];
    const strongConcepts = typedProfile.strong_concepts || typedProfile.strongConcepts || [];

    const actions = buildRecommendedActions({
      dueReviewCount: dueReviews.data?.length || 0,
      weakConcepts,
      notesWithoutQuiz,
      latestNote: notes[0] || null,
    });

    return NextResponse.json({
      overview: {
        totalNotes: notes.length,
        processedNotes: notes.filter((note) => ["processed", "organized"].includes(note.status)).length,
        dueReviewCount: dueReviews.data?.length || 0,
        weakConceptCount: weakConcepts.length,
        recentQuizCount: attemptsResult.data?.length || 0,
        conceptCount: conceptCounts.size,
      },
      profile: {
        weakConcepts: weakConcepts.slice(0, 8),
        strongConcepts: strongConcepts.slice(0, 8),
        interests: (typedProfile.interests || []).slice(0, 8),
        studyStats: typedProfile.study_stats || typedProfile.studyStats || {},
      },
      dueReviews: dueReviews.data || [],
      recentNotes: notes.slice(0, 8),
      notesWithoutQuiz,
      recentAttempts: attemptsResult.data || [],
      topConcepts,
      recommendedActions: actions,
    });
  } catch (error) {
    console.error("Error building dashboard:", error);
    return NextResponse.json({ error: "获取学习工作台失败" }, { status: 500 });
  }
}
