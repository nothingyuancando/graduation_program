import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";
import { formatSkillContextForPrompt } from "@/lib/services/skill-profile";

interface GenerateQuizOptions {
  client?: SupabaseClient;
}

type WeakConcept = {
  concept?: string;
};

type SkillPreferences = {
  difficultyPreference?: "easy" | "moderate" | "challenging";
};

type KeyPoint = string | { point?: string };

type GeneratedQuestion = {
  id: string;
  type: "choice" | "fill" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
};

type QuizDraft = {
  title?: string;
  questions?: GeneratedQuestion[];
};

function normalizeText(value?: string | null) {
  return (value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTextSeeds(note: { title: string; content: string; key_points?: unknown }) {
  const keyPoints = Array.isArray(note.key_points)
    ? note.key_points
        .map((item: KeyPoint) => (typeof item === "string" ? item : item?.point || ""))
        .map(normalizeText)
        .filter(Boolean)
    : [];

  const contentSeeds = normalizeText(note.content)
    .split(/[。！？.!?\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 8)
    .slice(0, 6);

  return [...keyPoints, ...contentSeeds].filter(Boolean);
}

function buildFallbackQuiz(note: { title: string; content: string; key_points?: unknown }): QuizDraft {
  const seeds = pickTextSeeds(note);
  const topic = normalizeText(note.title) || "这篇笔记";
  const first = seeds[0] || topic;
  const second = seeds[1] || first;
  const third = seeds[2] || second;

  return {
    title: `《${note.title}》学习巩固测验`,
    questions: [
      {
        id: "q1",
        type: "choice",
        question: "这篇笔记最主要讨论的主题是什么？",
        options: [`A. ${topic}`, "B. 与笔记无关的日程安排", "C. 单纯的工具配置记录", "D. 随机的生活备忘"],
        correct_answer: "A",
        explanation: "题目来自笔记标题和正文主线，用来确认你是否抓住了材料的核心主题。",
        difficulty: "easy",
      },
      {
        id: "q2",
        type: "choice",
        question: `下面哪一项更接近笔记中的关键内容：“${first.slice(0, 42)}${first.length > 42 ? "..." : ""}”？`,
        options: [`A. ${first.slice(0, 80)}`, "B. 完全跳过概念定义", "C. 只记录无关结论", "D. 不需要复习和验证"],
        correct_answer: "A",
        explanation: "本题从笔记正文抽取关键句生成，用来检验对原文信息的定位能力。",
        difficulty: "medium",
      },
      {
        id: "q3",
        type: "fill",
        question: "请补全这条笔记要点的关键词或核心含义。",
        correct_answer: second.slice(0, 80),
        explanation: "填空题用于主动回忆，不要求逐字一致，但要表达出同一核心含义。",
        difficulty: "medium",
      },
      {
        id: "q4",
        type: "fill",
        question: `根据笔记内容，“${third.slice(0, 28)}${third.length > 28 ? "..." : ""}”主要说明了什么？`,
        correct_answer: third.slice(0, 100),
        explanation: "这道题要求你把原文片段转换成自己的理解。",
        difficulty: "medium",
      },
      {
        id: "q5",
        type: "short_answer",
        question: "请用自己的话总结这篇笔记中最值得掌握的一个概念，并说明它为什么重要。",
        correct_answer: first,
        explanation: "简答题不追求死记硬背，重点看是否能解释概念、作用和使用场景。",
        difficulty: "hard",
      },
    ],
  };
}

function normalizeQuizDraft(draft: QuizDraft, note: { title: string; content: string; key_points?: unknown }) {
  const fallback = buildFallbackQuiz(note);
  const allowedTypes = new Set(["choice", "fill", "short_answer"]);
  const allowedDifficulties = new Set(["easy", "medium", "hard"]);
  const normalized = (draft.questions || [])
    .filter((item) => item?.question && item?.correct_answer)
    .slice(0, 5)
    .map((item, index) => ({
      ...item,
      id: item.id || `q${index + 1}`,
      type: allowedTypes.has(item.type) ? item.type : "short_answer",
      difficulty: allowedDifficulties.has(item.difficulty) ? item.difficulty : "medium",
      options: item.type === "choice" && Array.isArray(item.options) && item.options.length >= 2
        ? item.options
        : item.type === "choice"
          ? ["A. 正确选项", "B. 干扰选项", "C. 干扰选项", "D. 干扰选项"]
          : undefined,
      explanation: item.explanation || "这道题用于检查你是否真正理解了笔记中的核心内容。",
    }));

  return {
    title: draft.title || fallback.title,
    questions: normalized.length >= 3 ? normalized : fallback.questions || [],
  };
}

export async function generateQuizForNote(
  noteId: string,
  userId: string,
  options?: GenerateQuizOptions
) {
  const client = options?.client || getApiClient();

  const { data: note, error: noteError } = await client
    .from("notes")
    .select("id, title, content, tags, key_points")
    .eq("id", noteId)
    .eq("user_id", userId)
    .single();

  if (noteError || !note) {
    throw new Error("Note not found");
  }

  const { data: profile } = await client
    .from("user_learning_profiles")
    .select("weak_concepts")
    .eq("user_id", userId)
    .single();

  const weakConcepts = (profile?.weak_concepts as WeakConcept[] | undefined) || [];
  const weakContext = weakConcepts.length
    ? `\n\n用户的薄弱概念：${weakConcepts
        .slice(0, 5)
        .map((item) => item.concept)
        .join("、")}（请适当增加针对这些概念的题目）`
    : "";

  // 获取用户技能画像
  let skillContext = "";
  try {
    skillContext = await formatSkillContextForPrompt(userId, client);
  } catch {
    // skill context is optional
  }

  // 根据技能画像调整难度分布
  let difficultyHint = "";
  if (skillContext) {
    const { data: skillData } = await client
      .from("user_skills")
      .select("subject_levels, preferences")
      .eq("user_id", userId)
      .single();

    if (skillData?.preferences) {
      const prefs = skillData.preferences as SkillPreferences;
      if (prefs.difficultyPreference === "easy") {
        difficultyHint = "\n难度偏好：用户偏好简单题目，请多出 easy 和 medium 难度的题。";
      } else if (prefs.difficultyPreference === "challenging") {
        difficultyHint = "\n难度偏好：用户偏好有挑战性的题目，请多出 medium 和 hard 难度的题。";
      }
    }
  }

  const keyPointsText = Array.isArray(note.key_points)
    ? note.key_points
        .map((item: KeyPoint) => (typeof item === "string" ? item : item?.point || ""))
        .filter(Boolean)
        .join("\n- ")
    : "";

  const tagsText =
    Array.isArray(note.tags) && note.tags.length > 0 ? `\n标签：${note.tags.join("、")}` : "";

  const prompt = `你是专业的教育测验生成助手。请根据以下笔记内容生成 5 道练习题。
笔记标题：${note.title}
笔记内容：${note.content}${tagsText}${keyPointsText ? `\n关键要点：\n- ${keyPointsText}` : ""}${weakContext}${skillContext}${difficultyHint}

题型要求：
- 2 道选择题
- 2 道填空题
- 1 道简答题

返回 JSON：
{
  "title": "测验标题",
  "questions": [
    {
      "id": "q1",
      "type": "choice|fill|short_answer",
      "question": "题目",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct_answer": "答案",
      "explanation": "解析",
      "difficulty": "easy|medium|hard"
    }
  ]
}

要求：只返回有效 JSON，题目必须紧扣笔记内容。`;

  let quizData: QuizDraft;
  try {
    const llmClient = createLLMClient({ userId });
    const response = await llmClient.invoke(
      [
        {
          role: "system",
          content: "你是专业的教育测验生成助手，擅长根据学习材料生成高质量练习题。",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.5 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in LLM response");
    }
    quizData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Quiz LLM generation failed, using fallback quiz:", error);
    quizData = buildFallbackQuiz(note);
  }

  const normalizedQuiz = normalizeQuizDraft(quizData, note);

  const { data: quiz, error: insertError } = await client
    .from("quizzes")
    .insert({
      user_id: userId,
      note_id: noteId,
      title: normalizedQuiz.title || `基于《${note.title}》的练习测验`,
      questions: normalizedQuiz.questions || [],
      question_count: normalizedQuiz.questions?.length || 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return quiz;
}
