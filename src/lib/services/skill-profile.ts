import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";

interface SkillProfile {
  subjectLevels: Array<{
    subject: string;
    level: "beginner" | "intermediate" | "advanced" | "expert";
    confidence: number;
  }>;
  learningStyle: {
    preferredFormat: "visual" | "text" | "examples" | "interactive";
    pace: "slow" | "moderate" | "fast";
    detailLevel: "brief" | "moderate" | "detailed";
  };
  goals: Array<{
    goal: string;
    deadline?: string;
    status: "active" | "completed" | "paused";
  }>;
  strengths: string[];
  preferences: {
    language?: string;
    difficultyPreference?: "easy" | "moderate" | "challenging";
    sessionDuration?: number;
  };
}

type SkillProfileDbUpdates = {
  updated_at: string;
  subject_levels?: SkillProfile["subjectLevels"];
  learning_style?: SkillProfile["learningStyle"];
  goals?: SkillProfile["goals"];
  strengths?: SkillProfile["strengths"];
  preferences?: SkillProfile["preferences"];
};

const DEFAULT_SKILL_PROFILE: SkillProfile = {
  subjectLevels: [],
  learningStyle: {
    preferredFormat: "text",
    pace: "moderate",
    detailLevel: "moderate",
  },
  goals: [],
  strengths: [],
  preferences: {},
};

export async function getOrCreateSkillProfile(
  userId: string,
  client?: SupabaseClient
): Promise<SkillProfile> {
  const db = client || getApiClient();

  const { data } = await db
    .from("user_skills")
    .select("subject_levels, learning_style, goals, strengths, preferences")
    .eq("user_id", userId)
    .single();

  if (!data) return { ...DEFAULT_SKILL_PROFILE };

  return {
    subjectLevels: (data.subject_levels as SkillProfile["subjectLevels"]) || [],
    learningStyle: (data.learning_style as SkillProfile["learningStyle"]) || DEFAULT_SKILL_PROFILE.learningStyle,
    goals: (data.goals as SkillProfile["goals"]) || [],
    strengths: (data.strengths as SkillProfile["strengths"]) || [],
    preferences: (data.preferences as SkillProfile["preferences"]) || {},
  };
}

export async function updateSkillProfile(
  userId: string,
  updates: Partial<SkillProfile>,
  client?: SupabaseClient
): Promise<SkillProfile> {
  const db = client || getApiClient();

  const dbUpdates: SkillProfileDbUpdates = { updated_at: new Date().toISOString() };
  if (updates.subjectLevels !== undefined) dbUpdates.subject_levels = updates.subjectLevels;
  if (updates.learningStyle !== undefined) dbUpdates.learning_style = updates.learningStyle;
  if (updates.goals !== undefined) dbUpdates.goals = updates.goals;
  if (updates.strengths !== undefined) dbUpdates.strengths = updates.strengths;
  if (updates.preferences !== undefined) dbUpdates.preferences = updates.preferences;

  const { data: existing } = await db
    .from("user_skills")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (existing) {
    await db.from("user_skills").update(dbUpdates).eq("user_id", userId);
  } else {
    await db.from("user_skills").insert({ user_id: userId, ...dbUpdates });
  }

  return getOrCreateSkillProfile(userId, db);
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  expert: "专家",
};

const FORMAT_LABELS: Record<string, string> = {
  visual: "图文并茂",
  text: "文本阅读",
  examples: "案例学习",
  interactive: "互动练习",
};

const PACE_LABELS: Record<string, string> = {
  slow: "循序渐进",
  moderate: "适中",
  fast: "快速",
};

const DETAIL_LABELS: Record<string, string> = {
  brief: "简洁",
  moderate: "中等",
  detailed: "详细",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "偏简单",
  moderate: "适中",
  challenging: "有挑战性",
};

export async function formatSkillContextForPrompt(
  userId: string,
  client?: SupabaseClient
): Promise<string> {
  const profile = await getOrCreateSkillProfile(userId, client);

  const parts: string[] = [];

  if (profile.subjectLevels.length > 0) {
    const subjects = profile.subjectLevels
      .map((s) => `${s.subject}(${LEVEL_LABELS[s.level] || s.level})`)
      .join("、");
    parts.push(`- 学科水平：${subjects}`);
  }

  const style = profile.learningStyle;
  parts.push(
    `- 学习偏好：${FORMAT_LABELS[style.preferredFormat] || style.preferredFormat}，节奏${PACE_LABELS[style.pace] || style.pace}，详细程度${DETAIL_LABELS[style.detailLevel] || style.detailLevel}`
  );

  if (profile.goals.length > 0) {
    const activeGoals = profile.goals
      .filter((g) => g.status === "active")
      .map((g) => g.goal + (g.deadline ? `(截止${g.deadline})` : ""))
      .join("、");
    if (activeGoals) parts.push(`- 学习目标：${activeGoals}`);
  }

  if (profile.strengths.length > 0) {
    parts.push(`- 强势领域：${profile.strengths.join("、")}`);
  }

  if (profile.preferences.difficultyPreference) {
    parts.push(`- 难度偏好：${DIFFICULTY_LABELS[profile.preferences.difficultyPreference] || profile.preferences.difficultyPreference}`);
  }

  if (parts.length === 0) return "";

  return `\n\n用户技能画像：\n${parts.join("\n")}`;
}
