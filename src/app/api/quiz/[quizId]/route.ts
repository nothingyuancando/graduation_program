import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/quiz/[quizId] — 获取单个测验详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const quizId = (await params).quizId;
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();

    const { data: quiz, error } = await client
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (error || !quiz) {
      return NextResponse.json({ error: "测验不存在" }, { status: 404 });
    }

    // 获取该测验的作答记录
    const { data: attempts } = await client
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false });

    return NextResponse.json({ quiz, attempts: attempts || [] });
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return NextResponse.json({ error: "获取测验详情失败" }, { status: 500 });
  }
}
