import { classifySubject } from "@/lib/services/subject-classification";
import type { LearningSkill, SkillInput } from "./types";

export const subjectClassificationSkill: LearningSkill = {
  id: "subject-classification",
  name: "科目自动分类 Skill",
  description: "根据标题、正文、标签、用户学科画像和大模型语义判断笔记所属科目。",
  intents: ["classify", "classify_note_subject", "batch_classify_notes", "subject_overview"],

  async canHandle(input: SkillInput) {
    if (this.intents.includes(input.intent)) return 1;
    const text = `${input.title || ""} ${input.content || ""}`;
    return /科目|学科|课程|分类|归类|未分类|subject/i.test(text) ? 0.9 : 0.2;
  },

  async run(input: SkillInput) {
    const result = await classifySubject({
      userId: input.userId,
      noteId: input.noteId,
      title: input.title || "",
      content: input.content || "",
      summary: input.summary,
      tags: input.tags || [],
      themes: input.themes || [],
      subjectCandidates: input.subjectCandidates,
    });

    return {
      skillId: this.id,
      success: true,
      confidence: result.confidence,
      data: result as unknown as Record<string, unknown>,
      message: `已识别为「${result.subject}」，置信度 ${Math.round(result.confidence * 100)}%。`,
    };
  },
};
