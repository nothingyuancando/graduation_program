import type { LearningSkill, SkillInput } from "./types";
import { subjectClassificationSkill } from "./subject-classification.skill";

const skills: LearningSkill[] = [subjectClassificationSkill];

export function getSkills() {
  return skills;
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
