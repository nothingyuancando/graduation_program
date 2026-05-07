import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchSkills } from "@/lib/skills";

export const searchSkillsTool = tool(
  async (input: { query: string }) => {
    const skills = searchSkills(input.query);

    return JSON.stringify({
      success: true,
      skills,
      message:
        skills.length > 0
          ? "已找到匹配技能。启用未启用技能前，需要遵守返回的确认要求。"
          : "未找到匹配技能。",
    });
  },
  {
    name: "search_skills",
    description: "当用户需要当前 Agent 可能还不会的功能时，搜索受控技能市场。不会下载或启用技能。",
    schema: z.object({
      query: z.string().min(1).describe("用户需要的能力，例如 docx、word、anki、思维导图、出题"),
    }),
  }
);

