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

  let quizData: { title?: string; questions?: GeneratedQuestion[] };
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found");
    }
    quizData = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Failed to parse quiz JSON:", error);
    throw new Error("Quiz JSON parse failed");
  }

  const { data: quiz, error: insertError } = await client
    .from("quizzes")
    .insert({
      user_id: userId,
      note_id: noteId,
      title: quizData.title || `基于《${note.title}》的练习测验`,
      questions: quizData.questions || [],
      question_count: quizData.questions?.length || 0,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    throw insertError;
  }

  return quiz;
}
