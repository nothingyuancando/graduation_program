import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { enableSkill } from "@/lib/skills";

export const enableSkillTool = tool(
  async (input: { skillId: string; confirmation?: string }) => {
    const result = enableSkill(input.skillId, input.confirmation);
    return JSON.stringify(result);
  },
  {
    name: "enable_skill",
    description:
      "启用项目内置白名单技能。不会远程下载、不会安装 npm 包、不会执行 shell。若技能要求确认，必须由用户明确提供 ENABLE <skillId> 确认码。",
    schema: z.object({
      skillId: z.string().min(1).describe("要启用的技能 ID"),
      confirmation: z
        .string()
        .optional()
        .describe("用户明确提供的确认码，格式必须是 ENABLE <skillId>"),
    }),
  }
);

