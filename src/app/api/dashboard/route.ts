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

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  cognitive_level?: string | null;
  status: string;
  deadline?: string | null;
  knowledge_points?: string[] | null;
  daily_plan?: unknown[] | null;
  progress?: number | null;
  updated_at?: string | null;
};

type FeynmanAttemptRow = {
  goal_id?: string | null;
  concept?: string | null;
  score?: number | null;
};

type MasteryRow = {
  concept?: string | null;
  mastery_score?: string | number | null;
  feynman_score?: string | number | null;
};

function conceptText(item: unknown) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "concept" in item) {
    return String((item as WeakConcept).concept || "");
  }
  return "";
}

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

function noteSearchText(note: NoteRow & { key_points?: unknown }) {
  const keyPoints = Array.isArray(note.key_points) ? note.key_points.map(keyPointText).join(" ") : "";
  return normalize([note.title, note.summary, note.subject, note.tags?.join(" "), keyPoints].filter(Boolean).join(" "));
}

function noteMatchesGoal(note: NoteRow & { key_points?: unknown }, goal: GoalRow) {
  const text = noteSearchText(note);
  const terms = [goal.title, ...(goal.knowledge_points || [])]
    .map((term) => normalize(term))
    .filter((term) => term.length >= 2);

  if (!terms.length) return false;
  return terms.some((term) => text.includes(term) || term.includes(normalize(note.subject)));
}

function buildLearningSpaces(input: {
  goals: GoalRow[];
  notes: Array<NoteRow & { key_points?: unknown }>;
  entities: EntityRow[];
  attempts: FeynmanAttemptRow[];
  masteryRows: MasteryRow[];
}) {
  const entitiesByNoteId = new Map<string, EntityRow[]>();
  for (const entity of input.entities) {
    const rows = entitiesByNoteId.get(entity.note_id) || [];
    rows.push(entity);
    entitiesByNoteId.set(entity.note_id, rows);
  }

  const attemptsByGoalId = new Map<string, FeynmanAttemptRow[]>();
  for (const attempt of input.attempts) {
    if (!attempt.goal_id) continue;
    const rows = attemptsByGoalId.get(attempt.goal_id) || [];
    rows.push(attempt);
    attemptsByGoalId.set(attempt.goal_id, rows);
  }

  const masteryByConcept = new Map(
    input.masteryRows
      .filter((row) => row.concept)
      .map((row) => [
        normalize(row.concept),
        Number(row.mastery_score ?? row.feynman_score ?? 0) || 0,
      ])
  );

  return input.goals.slice(0, 8).map((goal) => {
    const relatedNotes = input.notes.filter((note) => noteMatchesGoal(note, goal)).slice(0, 4);
    const conceptSet = new Set<string>();

    for (const point of goal.knowledge_points || []) {
      if (point) conceptSet.add(point);
    }

    for (const note of relatedNotes) {
      for (const entity of entitiesByNoteId.get(note.id) || []) {
        if (entity.entity_name) conceptSet.add(entity.entity_name);
      }
    }

    const concepts = [...conceptSet].slice(0, 10);
    const masteryScores = concepts
      .map((concept) => masteryByConcept.get(normalize(concept)))
      .filter((score): score is number => typeof score === "number");
    const masteryScore = masteryScores.length
      ? Math.round(masteryScores.reduce((sum, score) => sum + score, 0) / masteryScores.length)
      : goal.progress || 0;
    const goalAttempts = attemptsByGoalId.get(goal.id) || [];
    const attemptedConcepts = new Set(goalAttempts.map((attempt) => normalize(attempt.concept)).filter(Boolean));
    const nextConcept = concepts.find((concept) => !attemptedConcepts.has(normalize(concept))) || concepts[0] || goal.title;

    let stage = "目标设定";
    let nextAction = {
      label: "完善学习路径",
      href: "/goals",
      type: "path",
    };

    if (!concepts.length) {
      stage = "目标设定";
      nextAction = { label: "补充知识点", href: "/goals", type: "path" };
    } else if (!relatedNotes.length) {
      stage = "知识摄入";
      nextAction = { label: "导入或写一篇笔记", href: "/upload", type: "note" };
    } else if (!goalAttempts.length || nextConcept) {
      stage = "深度理解";
      nextAction = {
        label: `复述「${nextConcept}」`,
        href: `/feynman?goalId=${goal.id}`,
        type: "feynman",
      };
    } else {
      stage = "主动回忆";
      nextAction = {
        label: "生成测验验证掌握度",
        href: relatedNotes[0] ? `/quiz/${relatedNotes[0].id}` : "/review",
        type: "quiz",
      };
    }

    return {
      id: goal.id,
      title: goal.title,
      description: goal.description || "",
      cognitiveLevel: goal.cognitive_level || "understand",
      status: goal.status,
      deadline: goal.deadline || null,
      stage,
      progress: goal.progress || 0,
      masteryScore,
      conceptCount: concepts.length,
      noteCount: relatedNotes.length,
      feynmanCount: goalAttempts.length,
      concepts,
      relatedNotes: relatedNotes.map((note) => ({
        id: note.id,
        title: note.title,
        summary: note.summary,
        subject: note.subject,
        status: note.status,
        updated_at: note.updated_at || note.created_at,
      })),
      nextAction,
    };
  });
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

    const [profile, dueReviews, notesResult, attemptsResult, goalsResult, feynmanAttemptsResult, masteryResult] = await Promise.all([
      getOrCreateLearningProfile(user.id, { client }),
      client
        .from("flashcard_reviews")
        .select("id, note_id, question, due_date")
        .eq("user_id", user.id)
        .lte("due_date", now)
        .limit(10),
      client
        .from("notes")
        .select("id, title, summary, subject, tags, key_points, status, updated_at, created_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(30),
      client
        .from("quiz_attempts")
        .select("id, quiz_id, score, total_correct, total_questions, completed_at, weak_points")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(5),
      client
        .from("learning_goals")
        .select("id, title, description, cognitive_level, status, deadline, knowledge_points, daily_plan, progress, updated_at")
        .eq("user_id", user.id)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(20),
      client
        .from("feynman_attempts")
        .select("goal_id, concept, score")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200),
      client
        .from("concept_mastery")
        .select("concept, mastery_score, feynman_score")
        .eq("user_id", user.id)
        .limit(500),
    ]);

    const notes = (notesResult.data || []) as NoteRow[];
    const noteIds = notes.map((note) => note.id);

    const [quizzesResult, conceptRowsResult] = noteIds.length
      ? await Promise.all([
          client.from("quizzes").select("note_id").eq("user_id", user.id).in("note_id", noteIds),
          client
            .from("note_entities")
            .select("entity_name, entity_type, note_id, confidence")
            .in("note_id", noteIds)
            .limit(300),
        ])
      : [
          { data: [] as QuizRow[] },
          { data: [] as EntityRow[] },
        ];

    const quizzes = (quizzesResult.data || []) as QuizRow[];
    const quizNoteIds = new Set(quizzes.map((quiz) => quiz.note_id));
    const notesWithoutQuiz = notes
      .filter((note) => !quizNoteIds.has(note.id) && ["processed", "organized"].includes(note.status))
      .slice(0, 5);

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
    const learningSpaces = buildLearningSpaces({
      goals: (goalsResult.data || []) as GoalRow[],
      notes: notes as Array<NoteRow & { key_points?: unknown }>,
      entities: conceptRows,
      attempts: (feynmanAttemptsResult.data || []) as FeynmanAttemptRow[],
      masteryRows: (masteryResult.data || []) as MasteryRow[],
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
      learningSpaces,
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
