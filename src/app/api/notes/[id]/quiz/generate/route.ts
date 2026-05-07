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
    const message = error instanceof Error ? error.message : "未知错误";
    const isDatabaseError = /relation|column|violates|duplicate|database|schema/i.test(message);
    return NextResponse.json(
      {
        error: isDatabaseError ? "测验保存失败，请检查数据库表结构" : "生成练习题失败",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
