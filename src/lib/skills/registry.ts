import type { LearningSkill, SkillInput, SkillInstallResult, SkillManifest } from "./types";
import {
  findMarketplaceSkill,
  getMarketplaceSkills,
  SAFE_SKILL_CONFIRMATION_PREFIX,
  searchMarketplaceSkills,
} from "./marketplace";
import { subjectClassificationSkill } from "./subject-classification.skill";

const skills: LearningSkill[] = [subjectClassificationSkill];
const enabledSkillIds = new Set(
  getMarketplaceSkills()
    .filter((skill) => skill.enabled)
    .map((skill) => skill.id)
);

export function getSkills() {
  return skills;
}

export function listSkillManifests(): SkillManifest[] {
  return getMarketplaceSkills().map((skill) => ({
    ...skill,
    enabled: enabledSkillIds.has(skill.id),
  }));
}

export function listEnabledSkills(): SkillManifest[] {
  return listSkillManifests().filter((skill) => skill.enabled);
}

export function searchSkills(query: string): SkillManifest[] {
  return searchMarketplaceSkills(query).map((skill) => ({
    ...skill,
    enabled: enabledSkillIds.has(skill.id),
  }));
}

export function enableSkill(skillId: string, confirmation?: string): SkillInstallResult {
  const skill = findMarketplaceSkill(skillId);

  if (!skill) {
    return {
      success: false,
      installed: false,
      message: `未找到技能：${skillId}`,
    };
  }

  if (skill.installType !== "builtin" || skill.riskLevel === "high") {
    return {
      success: false,
      installed: false,
      skill: { ...skill, enabled: false },
      message: "安全策略已阻止该技能：当前只允许启用项目内置白名单技能，不允许远程下载、安装依赖或执行外部代码。",
    };
  }

  if (skill.requiresUserConfirmation) {
    const expected = `${SAFE_SKILL_CONFIRMATION_PREFIX} ${skill.id}`;
    if (confirmation !== expected) {
      return {
        success: false,
        installed: false,
        skill: { ...skill, enabled: enabledSkillIds.has(skill.id) },
        message: `启用该技能需要用户确认。请明确发送确认码：${expected}`,
      };
    }
  }

  enabledSkillIds.add(skill.id);

  return {
    success: true,
    installed: true,
    skill: { ...skill, enabled: true },
    message: `已启用技能：${skill.name}`,
  };
}

export function isSkillEnabled(skillId: string): boolean {
  return enabledSkillIds.has(skillId);
}

export async function selectSkill(input: SkillInput) {
  const scored = await Promise.all(
    skills.map(async (skill) => ({
      skill,
      score: await skill.canHandle(input),
    }))
  );

  return scored.sort((a, b) => b.score - a.score)[0] || null;
}
