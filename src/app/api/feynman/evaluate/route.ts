import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { createLLMClient } from "@/lib/llm-provider";
import { getApiClient } from "@/storage/database/supabase-client";

type FeynmanResult = {
  score: number;
  level: string;
  missingPoints: string[];
  misconceptions: string[];
  followUpQuestions: string[];
  recommendedReview: string[];
  aiFeedback: string;
};

type ConceptEntry = {
  concept: string;
  score: number;
  lastSeen: string;
};

type KeyPoint = string | { point?: string; sourceQuote?: string; confidence?: number };

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  key_points?: KeyPoint[] | null;
  tags?: string[] | null;
  subject?: string | null;
  updated_at?: string | null;
};

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  knowledge_points?: string[] | null;
};

const evaluateSchema = z.object({
  concept: z.string().min(1).max(500),
  userExplanation: z.string().min(10).max(12000),
  noteId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
});

function parseJsonObject<T>(content: string, fallback: T): T {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as T;
  } catch {
    return fallback;
  }
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function keyPointText(item: KeyPoint) {
  return typeof item === "string" ? item : String(item?.point || "");
}

function stripMarkdown(value?: string | null) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textIncludesConcept(value: unknown, concept: string) {
  const text = normalize(String(value || ""));
  const key = normalize(concept);
  return Boolean(text && key && (text.includes(key) || key.includes(text)));
}

function noteScore(note: NoteRow, concept: string) {
  let score = 0;
  if (textIncludesConcept(note.title, concept)) score += 8;
  if (textIncludesConcept(note.subject, concept)) score += 3;
  if (textIncludesConcept(note.summary, concept)) score += 5;
  if ((note.tags || []).some((tag) => textIncludesConcept(tag, concept))) score += 5;
  if ((note.key_points || []).some((point) => textIncludesConcept(keyPointText(point), concept))) score += 10;
  if (textIncludesConcept(note.content, concept)) score += 4;
  return score;
}

function buildKnowledgeContext(input: { concept: string; goal: GoalRow | null; notes: NoteRow[] }) {
  const parts: string[] = [];

  parts.push(`待验证概念：${input.concept}`);

  if (input.goal) {
    parts.push(
      [
        "关联学习目标：",
        `标题：${input.goal.title}`,
        input.goal.description ? `说明：${input.goal.description}` : "",
        input.goal.knowledge_points?.length ? `目标知识点：${input.goal.knowledge_points.join("、")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  if (input.notes.length) {
    parts.push(
      [
        "知识库参考笔记：",
        ...input.notes.map((note, index) => {
          const keyPoints = (note.key_points || []).map(keyPointText).filter(Boolean).slice(0, 8);
          const body = stripMarkdown(note.content).slice(0, 1800);
          return [
            `笔记 ${index + 1}：${note.title}`,
            note.subject ? `学科：${note.subject}` : "",
            note.summary ? `摘要：${note.summary}` : "",
            keyPoints.length ? `关键点：${keyPoints.join("；")}` : "",
            body ? `正文摘录：${body}` : "",
          ]
            .filter(Boolean)
            .join("\n");
        }),
      ].join("\n\n")
    );
  } else {
    parts.push("知识库参考笔记：未检索到直接相关笔记。评分时需要明确指出参考依据不足。");
  }

  return parts.join("\n\n").slice(0, 8000);
}

function fallbackEvaluate(concept: string, explanation: string, notes: NoteRow[]): FeynmanResult {
  const cleanExplanation = explanation.trim();
  const referenceTerms = notes
    .flatMap((note) => [
      note.title,
      note.summary || "",
      ...(note.tags || []),
      ...(note.key_points || []).map(keyPointText),
    ])
    .join(" ")
    .split(/[\s,，。；;、:：()（）「」“”]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 16);
  const uniqueTerms = [...new Set(referenceTerms)].slice(0, 30);
  const hitCount = uniqueTerms.filter((term) => cleanExplanation.includes(term)).length;

  const lengthScore = Math.min(30, Math.floor(cleanExplanation.length / 18));
  const structureScore = ["因为", "例如", "所以", "区别", "步骤", "应用", "问题", "容易"].reduce(
    (score, marker) => score + (cleanExplanation.includes(marker) ? 5 : 0),
    0
  );
  const referenceScore = Math.min(25, hitCount * 5);
  const score = Math.max(30, Math.min(82, lengthScore + structureScore + referenceScore + 20));

  return {
    score,
    level: score >= 75 ? "基本理解，但仍建议用例题或追问验证" : "理解还不稳定，需要回到参考笔记补齐关键点",
    missingPoints: [`需要补充“${concept}”的定义、适用条件、典型例子和易混点。`],
    misconceptions: [],
    followUpQuestions: [
      `如果让你用一个具体场景解释“${concept}”，你会怎么讲？`,
      `“${concept}”最容易和哪个概念混淆？区别是什么？`,
    ],
    recommendedReview: notes.length ? notes.slice(0, 3).map((note) => note.title) : [concept],
    aiFeedback:
      "模型暂时不可用，系统已用知识库命中度和复述结构做兜底评分。请对照参考笔记补充定义、例子、边界条件和易错点后再复述一次。",
  };
}

function normalizeResult(raw: Partial<FeynmanResult>, fallback: FeynmanResult): FeynmanResult {
  const score = clampScore(raw.score ?? fallback.score);
  const missingPoints = normalizeStringArray(raw.missingPoints);
  const followUpQuestions = normalizeStringArray(raw.followUpQuestions);
  const recommendedReview = normalizeStringArray(raw.recommendedReview);

  return {
    score,
    level: String(raw.level || fallback.level),
    missingPoints: missingPoints.length ? missingPoints : fallback.missingPoints,
    misconceptions: normalizeStringArray(raw.misconceptions),
    followUpQuestions: followUpQuestions.length ? followUpQuestions : fallback.followUpQuestions,
    recommendedReview: recommendedReview.length ? recommendedReview : fallback.recommendedReview,
    aiFeedback: String(raw.aiFeedback || fallback.aiFeedback),
  };
}

async function updateConceptMastery(input: {
  userId: string;
  concept: string;
  feynmanScore: number;
  attemptId: string;
}) {
  const client = getApiClient();
  const now = new Date().toISOString();

  const { data: existing } = await client
    .from("concept_mastery")
    .select("*")
    .eq("user_id", input.userId)
    .eq("concept", input.concept)
    .single();

  const quizScore = existing?.quiz_score == null ? null : Number(existing.quiz_score);
  const flashcardScore = existing?.flashcard_score == null ? null : Number(existing.flashcard_score);
  const scores = [quizScore, flashcardScore, input.feynmanScore].filter(
    (score): score is number => Number.isFinite(score)
  );
  const masteryScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : input.feynmanScore;

  const payload = {
    user_id: input.userId,
    concept: input.concept,
    quiz_score: quizScore,
    flashcard_score: flashcardScore,
    feynman_score: input.feynmanScore,
    mastery_score: masteryScore,
    evidence: {
      ...(existing?.evidence && typeof existing.evidence === "object" ? existing.evidence : {}),
      lastFeynmanAttemptId: input.attemptId,
      lastFeynmanAt: now,
    },
    updated_at: now,
  };

  await client.from("concept_mastery").upsert(payload, { onConflict: "user_id,concept" });
  return masteryScore;
}

async function updateLearningProfile(input: {
  userId: string;
  concept: string;
  score: number;
}) {
  const client = getApiClient();
  const now = new Date().toISOString();
  const { data: profile } = await client
    .from("user_learning_profiles")
    .select("*")
    .eq("user_id", input.userId)
    .single();

  const weakConcepts = ((profile?.weak_concepts || []) as ConceptEntry[]).filter(
    (item) => item.concept !== input.concept
  );
  const strongConcepts = ((profile?.strong_concepts || []) as ConceptEntry[]).filter(
    (item) => item.concept !== input.concept
  );

  if (input.score < 70) {
    weakConcepts.unshift({
      concept: input.concept,
      score: Number(((100 - input.score) / 100).toFixed(2)),
      lastSeen: now,
    });
  } else if (input.score >= 85) {
    strongConcepts.unshift({
      concept: input.concept,
      score: Number((input.score / 100).toFixed(2)),
      lastSeen: now,
    });
  }

  const payload = {
    user_id: input.userId,
    weak_concepts: weakConcepts.slice(0, 20),
    strong_concepts: strongConcepts.slice(0, 20),
    interests: profile?.interests || [],
    study_stats: profile?.study_stats || {},
    updated_at: now,
  };

  if (profile?.id) {
    await client.from("user_learning_profiles").update(payload).eq("user_id", input.userId);
  } else {
    await client.from("user_learning_profiles").insert(payload);
  }
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = evaluateSchema.parse(body);
    const client = getApiClient();

    const [selectedNoteResult, goalResult, allNotesResult] = await Promise.all([
      input.noteId
        ? client
            .from("notes")
            .select("id, title, summary, content, key_points, tags, subject, updated_at")
            .eq("id", input.noteId)
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .single()
        : Promise.resolve({ data: null }),
      input.goalId
        ? client
            .from("learning_goals")
            .select("id, title, description, knowledge_points")
            .eq("id", input.goalId)
            .eq("user_id", user.id)
            .single()
        : Promise.resolve({ data: null }),
      client
        .from("notes")
        .select("id, title, summary, content, key_points, tags, subject, updated_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(80),
    ]);

    if (allNotesResult.error) {
      return NextResponse.json({ error: allNotesResult.error.message }, { status: 400 });
    }

    const allNotes = ((allNotesResult.data || []) as NoteRow[]).sort(
      (a, b) => noteScore(b, input.concept) - noteScore(a, input.concept)
    );
    const selectedNote = selectedNoteResult.data as NoteRow | null;
    const relevantNotes = [
      ...(selectedNote ? [selectedNote] : []),
      ...allNotes.filter((note) => note.id !== selectedNote?.id && noteScore(note, input.concept) > 0),
    ].slice(0, 4);
    const goal = (goalResult.data as GoalRow | null) || null;
    const knowledgeContext = buildKnowledgeContext({
      concept: input.concept,
      goal,
      notes: relevantNotes,
    });

    const fallback = fallbackEvaluate(input.concept, input.userExplanation, relevantNotes);
    let result = fallback;
    let usedFallback = false;
    let fallbackReason = "";

    try {
      const llmClient = createLLMClient({ userId: user.id });
      const response = await llmClient.invoke(
        [
          {
            role: "system",
            content:
              "你是一名严格但鼓励学生的学习评估老师。你必须依据用户知识库中的参考笔记和学习目标来评估费曼复述，不要只评价表达流畅度。只输出有效 JSON。",
          },
          {
            role: "user",
            content: `请评估学生对概念“${input.concept}”的费曼复述。

【知识库评分依据】
${knowledgeContext}

【学生复述】
${input.userExplanation}

请返回 JSON：
{
  "score": 0-100,
  "level": "一句话说明理解水平",
  "missingPoints": ["相对知识库遗漏的关键点"],
  "misconceptions": ["和知识库不一致或可能误解的地方"],
  "followUpQuestions": ["继续追问的问题"],
  "recommendedReview": ["建议复习的概念或笔记主题"],
  "aiFeedback": "给学生的具体反馈，指出下一步怎么补强"
}

评分标准：
1. 是否说清概念定义和核心作用，最高 25 分。
2. 是否解释原理、因果关系或机制，最高 25 分。
3. 是否能举例或说明应用场景，最高 20 分。
4. 是否讲清边界、易错点或相近概念差异，最高 20 分。
5. 表达结构是否清晰，最高 10 分。

如果知识库依据不足，不要编造标准答案；请降低确定性，并在 missingPoints 或 aiFeedback 中提示需要补充参考笔记。`,
          },
        ],
        { temperature: 0.2, maxTokens: 1200 }
      );

      result = normalizeResult(parseJsonObject<Partial<FeynmanResult>>(response.content, fallback), fallback);
    } catch (error) {
      usedFallback = true;
      fallbackReason = error instanceof Error ? error.message : String(error);
      console.error("Feynman evaluation fallback:", error);
    }

    const { data: attempt, error: insertError } = await client
      .from("feynman_attempts")
      .insert({
        user_id: user.id,
        goal_id: input.goalId || null,
        note_id: input.noteId || relevantNotes[0]?.id || null,
        concept: input.concept,
        user_explanation: input.userExplanation,
        score: result.score,
        level: result.level,
        missing_points: result.missingPoints,
        misconceptions: result.misconceptions,
        follow_up_questions: result.followUpQuestions,
        recommended_review: result.recommendedReview,
        ai_feedback: result.aiFeedback,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    const masteryScore = await updateConceptMastery({
      userId: user.id,
      concept: input.concept,
      feynmanScore: result.score,
      attemptId: attempt.id,
    });

    await updateLearningProfile({
      userId: user.id,
      concept: input.concept,
      score: result.score,
    });

    return NextResponse.json({
      attempt,
      result,
      masteryScore,
      usedFallback,
      fallbackReason: usedFallback ? fallbackReason.split("\n").slice(0, 4).join("\n") : "",
      referenceNotes: relevantNotes.map((note) => ({ id: note.id, title: note.title })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error evaluating Feynman attempt:", error);
    return NextResponse.json({ error: "费曼复述评估失败" }, { status: 500 });
  }
}
