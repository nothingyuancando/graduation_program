import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type QuizSummary = {
  id: string;
  title: string;
  question_count: number;
  created_at: string;
};

// GET /api/notes/[id]/quiz — 获取笔记的所有测验列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const noteId = (await params).id;
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();

    const { data: quizzes, error } = await client
      .from("quizzes")
      .select("id, title, question_count, created_at")
      .eq("note_id", noteId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 获取每个测验的最高分
    const quizzesWithScores = await Promise.all(
      ((quizzes || []) as QuizSummary[]).map(async (quiz) => {
        const { data: attempts } = await client
          .from("quiz_attempts")
          .select("score")
          .eq("quiz_id", quiz.id)
          .eq("user_id", user.id)
          .order("score", { ascending: false })
          .limit(1);

        return {
          ...quiz,
          best_score: attempts && attempts.length > 0 ? parseFloat(attempts[0].score) : null,
          attempted: attempts && attempts.length > 0,
        };
      })
    );

    return NextResponse.json({ quizzes: quizzesWithScores });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    return NextResponse.json({ error: "获取测验列表失败" }, { status: 500 });
  }
}
