import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";
import { generateLearningPath } from "@/lib/services/learning-path";

const learningPathSchema = z.object({
  goal: z.string().min(2).max(300),
  days: z.coerce.number().int().min(1).max(30).default(7),
});

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = learningPathSchema.parse(body);
    const client = getApiClient();
    const plan = await generateLearningPath(user.id, input.goal, input.days, client);

    return NextResponse.json({ plan });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error generating learning path:", error);
    return NextResponse.json({ error: "学习路径生成失败" }, { status: 500 });
  }
}
