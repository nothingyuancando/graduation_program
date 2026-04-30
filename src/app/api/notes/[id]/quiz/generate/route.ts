import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";
import { generateQuizForNote } from "@/lib/services/quiz-generation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const noteId = (await params).id;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const quiz = await generateQuizForNote(noteId, user.id, {
      client: getApiClient(),
    });

    return NextResponse.json({
      quiz,
      message: "练习题生成成功",
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    return NextResponse.json({ error: "生成练习题失败" }, { status: 500 });
  }
}
