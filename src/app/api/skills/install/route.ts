import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { enableSkill } from "@/lib/skills";

const installSchema = z.object({
  skillId: z.string().min(1),
  confirmation: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = installSchema.parse(await request.json());
    const result = enableSkill(body.skillId, body.confirmation);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "技能启用失败" }, { status: 500 });
  }
}

