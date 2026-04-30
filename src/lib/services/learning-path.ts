import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";
import { getOrCreateLearningProfile } from "@/lib/services/learning-profile";
import { getOrCreateSkillProfile } from "@/lib/services/skill-profile";

export type LearningPathTask = {
  title: string;
  description: string;
  type: "review" | "learn" | "practice" | "quiz" | "project";
  noteIds?: string[];
  minutes?: number;
};

export type LearningPathDay = {
  day: number;
  focus: string;
  objective: string;
  tasks: LearningPathTask[];
  checkpoints: string[];
};

export type LearningPlan = {
  goal: string;
  days: LearningPathDay[];
  prerequisites: string[];
  weakPoints: string[];
  recommendedNotes: Array<{
    id: string;
    title: string;
    subject?: string | null;
    reason: string;
  }>;
  strategy: string;
};

type NoteForPath = {
  id: string;
  title: string;
  summary?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  key_points?: Array<string | { point?: string }> | null;
  updated_at?: string | null;
};

type WeakConcept = {
  concept?: string;
};

function parseJsonObject<T>(content: string, fallback: T): T {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as T;
  } catch (error) {
    console.error("Failed to parse learning path JSON:", error);
    return fallback;
  }
}

function normalizeDays(days: number) {
  if (!Number.isFinite(days)) return 7;
  return Math.min(Math.max(Math.round(days), 1), 30);
}

function noteKeywords(note: NoteForPath) {
  const keyPoints = (note.key_points || [])
    .map((item) => (typeof item === "object" && item?.point ? item.point : String(item)))
    .join(" ");
  return [
    note.title,
    note.summary || "",
    note.subject || "",
    ...(note.tags || []),
    keyPoints,
  ]
    .join(" ")
    .toLowerCase();
}

function rankNotes(notes: NoteForPath[], goal: string, weakPoints: string[]) {
  const keywords = [
    ...goal
      .toLowerCase()
      .split(/[\s,，。；;、:：]+/)
      .filter((item) => item.length >= 2),
    ...weakPoints.map((item) => item.toLowerCase()),
  ];

  return notes
    .map((note) => {
      const text = noteKeywords(note);
      const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
      return { ...note, score };
    })
    .sort((a, b) => b.score - a.score || (b.updated_at || "").localeCompare(a.updated_at || ""))
    .slice(0, 10);
}

function fallbackPlan(goal: string, days: number, notes: NoteForPath[], weakPoints: string[]): LearningPlan {
  const rankedNotes = rankNotes(notes, goal, weakPoints);
  const focusPool = [
    "目标拆解与前置知识梳理",
    "核心概念补齐",
    "薄弱点专项复习",
    "例题与卡片练习",
    "知识图谱串联",
    "综合输出与复盘",
  ];

  return {
    goal,
    prerequisites: weakPoints.slice(0, 6),
    weakPoints,
    recommendedNotes: rankedNotes.slice(0, 6).map((note) => ({
      id: note.id,
      title: note.title,
      subject: note.subject,
      reason: note.score > 0 ? "与目标或薄弱点匹配" : "近期相关学习资料",
    })),
    strategy: "先补前置概念，再按主题推进，最后通过测验和输出巩固。每天约 2 小时，按 复习-学习-练习-复盘 的节奏递进。",
    days: Array.from({ length: days }, (_, index) => {
      const note = rankedNotes[index % Math.max(rankedNotes.length, 1)];
      return {
        day: index + 1,
        focus: focusPool[index % focusPool.length],
        objective: `围绕“${goal}”完成第 ${index + 1} 天的阶段推进。`,
        tasks: [
          {
            title: "复习已有笔记",
            description: note ? `阅读并标注《${note.title}》中的关键概念。` : "阅读已有相关笔记，整理关键词。",
            type: "review",
            noteIds: note ? [note.id] : [],
            minutes: 35,
          },
          {
            title: "补齐薄弱点",
            description: weakPoints[index % Math.max(weakPoints.length, 1)]
              ? `重点理解：${weakPoints[index % weakPoints.length]}。`
              : "选择一个不熟悉概念，补充定义、例子和易错点。",
            type: "learn",
            noteIds: note ? [note.id] : [],
            minutes: 45,
          },
          {
            title: "练习与输出",
            description: "完成 3-5 个自测问题，并用自己的话写出当天总结。",
            type: "practice",
            minutes: 40,
          },
        ],
        checkpoints: ["能说清当天核心概念", "能完成至少 3 道自测题", "形成 100 字复盘"],
      };
    }),
  };
}

export async function generateLearningPath(
  userId: string,
  goal: string,
  days: number,
  client?: SupabaseClient
): Promise<LearningPlan> {
  const db = client || getApiClient();
  const normalizedDays = normalizeDays(days);

  const [skillProfile, learningProfile, notesResult] = await Promise.all([
    getOrCreateSkillProfile(userId, db),
    getOrCreateLearningProfile(userId, { client: db }),
    db
      .from("notes")
      .select("id, title, summary, subject, tags, key_points, updated_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(60),
  ]);

  const notes = (notesResult.data || []) as NoteForPath[];
  const weakPoints = (learningProfile.weak_concepts || learningProfile.weakConcepts || [])
    .slice(0, 10)
    .map((item: WeakConcept | string) => (typeof item === "string" ? item : item.concept || String(item)))
    .filter(Boolean);
  const rankedNotes = rankNotes(notes, goal, weakPoints);
  const fallback = fallbackPlan(goal, normalizedDays, notes, weakPoints);

  const llmClient = createLLMClient({ userId });
  const prompt = `你是 LearningPathAgent，根据用户技能画像、薄弱点、已有笔记和目标生成渐进式学习路径。

用户目标：${goal}
计划天数：${normalizedDays}
每天可用时间：2 小时

技能画像：
${JSON.stringify(skillProfile, null, 2)}

薄弱点：
${JSON.stringify(weakPoints, null, 2)}

相关笔记：
${JSON.stringify(
  rankedNotes.slice(0, 20).map((note) => ({
    id: note.id,
    title: note.title,
    subject: note.subject,
    summary: note.summary,
    tags: note.tags,
  })),
  null,
  2
)}

请输出 JSON，不要包裹 markdown：
{
  "goal": "用户目标",
  "prerequisites": ["达成目标前需要补齐的前置知识"],
  "weakPoints": ["优先处理的薄弱点"],
  "recommendedNotes": [{"id":"笔记ID","title":"笔记标题","subject":"科目","reason":"为什么推荐"}],
  "strategy": "整体学习策略，说明为什么这样安排",
  "days": [
    {
      "day": 1,
      "focus": "当天聚焦领域",
      "objective": "当天学习目标",
      "tasks": [
        {
          "title": "任务标题",
          "description": "具体怎么做",
          "type": "review|learn|practice|quiz|project",
          "noteIds": ["可选笔记ID"],
          "minutes": 40
        }
      ],
      "checkpoints": ["当天完成后应能做到什么"]
    }
  ]
}

要求：
1. days 数量必须等于 ${normalizedDays}。
2. 每天任务总时长约 120 分钟。
3. 学习路径要渐进：前置知识 -> 核心概念 -> 薄弱点专项 -> 练习测验 -> 综合输出。
4. 尽量引用已有笔记 ID，方便用户点击复习。
5. 不要编造不存在的笔记 ID。`;

  const response = await llmClient.invoke(
    [
      {
        role: "system",
        content: "你是个性化学习路径规划 Agent，擅长基于技能画像和知识图谱制定可执行计划。输出必须是有效 JSON。",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.35, maxTokens: 6000 }
  );

  const plan = parseJsonObject<LearningPlan>(response.content, fallback);

  if (!Array.isArray(plan.days) || plan.days.length !== normalizedDays) {
    return fallback;
  }

  try {
    await db.from("skill_runs").insert({
      user_id: userId,
      skill_id: "learning-path-agent",
      intent: "generate_learning_path",
      input: { goal, days: normalizedDays },
      output: plan,
      status: "completed",
      confidence: "0.85",
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to record learning path skill run:", error);
  }

  return plan;
}
