import type { SkillManifest } from "./types";

export const SAFE_SKILL_CONFIRMATION_PREFIX = "ENABLE";

const marketplaceSkills: SkillManifest[] = [
  {
    id: "subject-classification",
    name: "科目自动分类",
    description: "根据笔记标题、正文、标签和学习画像判断笔记所属科目。",
    capabilities: ["classify_note_subject", "batch_classify_notes", "subject_overview"],
    intents: ["classify", "classify_note_subject", "batch_classify_notes", "subject_overview"],
    enabled: true,
    source: "builtin",
    installType: "builtin",
    riskLevel: "low",
    toolNames: ["classify_note_subject", "batch_classify_notes", "get_subject_overview"],
    requiresUserConfirmation: false,
    installNotes: "内置技能，默认启用，不下载外部代码。",
  },
  {
    id: "note-analysis",
    name: "AI 笔记深度分析",
    description: "提取摘要、标签、实体、关键知识点和结构化学习内容。",
    capabilities: ["analyze_note"],
    intents: ["analysis", "summarize", "extract", "knowledge_points"],
    enabled: true,
    source: "builtin",
    installType: "builtin",
    riskLevel: "medium",
    toolNames: ["analyze_note"],
    requiresUserConfirmation: false,
    installNotes: "内置技能，会调用已配置的大模型。",
  },
  {
    id: "quiz-generation",
    name: "练习题生成",
    description: "根据指定笔记生成选择题、填空题和简答题。",
    capabilities: ["generate_quiz"],
    intents: ["quiz", "practice", "exam"],
    enabled: true,
    source: "builtin",
    installType: "builtin",
    riskLevel: "medium",
    toolNames: ["generate_quiz"],
    requiresUserConfirmation: false,
    installNotes: "内置技能，会调用已配置的大模型并写入测验记录。",
  },
  {
    id: "learning-path",
    name: "学习路径生成",
    description: "根据学习目标、已有笔记和薄弱概念生成阶段式学习计划。",
    capabilities: ["generate_learning_path"],
    intents: ["learning_path", "study_plan"],
    enabled: true,
    source: "builtin",
    installType: "builtin",
    riskLevel: "medium",
    toolNames: ["generate_learning_path"],
    requiresUserConfirmation: false,
    installNotes: "内置技能，会调用已配置的大模型。",
  },
  {
    id: "docx-parser",
    name: "Word 文档解析",
    description: "解析 .docx 文件并提取可用于笔记整理的正文内容。",
    capabilities: ["parse_docx"],
    intents: ["docx", "word", "document_import"],
    enabled: false,
    source: "builtin",
    installType: "builtin",
    riskLevel: "low",
    toolNames: [],
    requiresUserConfirmation: true,
    installNotes: "受控内置技能，只启用项目已有解析能力，不下载外部代码。",
  },
  {
    id: "remote-skill-install",
    name: "远程技能下载",
    description: "从外部市场下载并安装新技能。",
    capabilities: ["remote_download"],
    intents: ["install_remote_skill", "download_skill"],
    enabled: false,
    source: "marketplace",
    installType: "remote",
    riskLevel: "high",
    toolNames: [],
    requiresUserConfirmation: true,
    installNotes: "当前安全策略禁止远程代码下载和任意依赖安装。",
  },
];

export function getMarketplaceSkills(): SkillManifest[] {
  return marketplaceSkills.map((skill) => ({ ...skill }));
}

export function findMarketplaceSkill(skillId: string): SkillManifest | null {
  return getMarketplaceSkills().find((skill) => skill.id === skillId) || null;
}

export function searchMarketplaceSkills(query: string): SkillManifest[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return getMarketplaceSkills();

  return getMarketplaceSkills().filter((skill) => {
    const haystack = [
      skill.id,
      skill.name,
      skill.description,
      ...skill.capabilities,
      ...skill.intents,
      ...skill.toolNames,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

