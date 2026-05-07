import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listSkillManifests, searchSkills } from "@/lib/skills";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const skills = query ? searchSkills(query) : listSkillManifests();

  return NextResponse.json({
    skills,
    safetyPolicy: {
      allowedInstallTypes: ["builtin"],
      blocked: ["remote_download", "npm_install", "shell_execution"],
      confirmationFormat: "ENABLE <skillId>",
    },
  });
}

