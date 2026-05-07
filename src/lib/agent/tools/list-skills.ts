import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listSkillManifests } from "@/lib/skills";

export const listSkillsTool = tool(
  async (input: { enabledOnly?: boolean }) => {
    const skills = listSkillManifests().filter((skill) =>
      input.enabledOnly ? skill.enabled : true
    );

    return JSON.stringify({
      success: true,
      skills,
      safetyPolicy: {
        allowedInstallTypes: ["builtin"],
        blocked: ["remote_download", "npm_install", "shell_execution"],
        note: "Agent 只能启用项目内置白名单技能；远程下载和任意代码执行已禁用。",
      },
    });
  },
  {
    name: "list_skills",
    description: "查看当前项目可用技能、启用状态、风险等级和安全策略。",
    schema: z.object({
      enabledOnly: z.boolean().optional().default(false).describe("是否只返回已启用技能"),
    }),
  }
);

