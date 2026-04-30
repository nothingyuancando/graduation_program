import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type QuizAttemptRow = {
  id: string;
  quiz_id: string;
  [key: string]: unknown;
};

// GET /api/quiz/history — 用户测验历史
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

    // 获取作答记录
    const { data: attempts, error } = await client
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // 获取关联的测验和笔记信息
    const attemptsWithDetails = await Promise.all(
      ((attempts || []) as QuizAttemptRow[]).map(async (attempt) => {
        const { data: quiz } = await client
          .from("quizzes")
          .select("id, title, note_id, question_count")
          .eq("id", attempt.quiz_id)
          .single();

        let noteTitle = "";
        if (quiz?.note_id) {
          const { data: note } = await client
            .from("notes")
            .select("title")
            .eq("id", quiz.note_id)
            .single();
          noteTitle = note?.title || "";
        }

        return {
          ...attempt,
          quiz_title: quiz?.title || "未知测验",
          note_title: noteTitle,
          note_id: quiz?.note_id || "",
        };
      })
    );

    return NextResponse.json({ history: attemptsWithDetails });
  } catch (error) {
    console.error("Error fetching quiz history:", error);
    return NextResponse.json({ error: "获取测验历史失败" }, { status: 500 });
  }
}
