import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/checkin?month=2026-03 — 获取指定月份的打卡数据
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();
    const month = request.nextUrl.searchParams.get("month"); // 格式 YYYY-MM

    let startDate: string;
    let endDate: string;

    if (month) {
      startDate = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
    } else {
      // 默认当月
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }

    const { data, error } = await client
      .from("study_checkins")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ checkins: data || [] });
  } catch (error) {
    console.error("Error fetching checkins:", error);
    return NextResponse.json({ error: "获取打卡数据失败" }, { status: 500 });
  }
}

// POST /api/checkin — 手动打卡 + 自动统计当日活动
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();
    const body = await request.json();
    const { study_minutes = 0, checkin_note = "" } = body;

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 自动统计当日活动
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;

    // 统计今日创建的笔记数
    const { count: notesCreated } = await client
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd);

    // 统计今日复习次数
    const { count: notesReviewed } = await client
      .from("flashcard_reviews")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("last_reviewed", todayStart)
      .lte("last_reviewed", todayEnd);

    // 统计今日测验数
    const { count: quizzesTaken } = await client
      .from("quiz_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("completed_at", todayStart)
      .lte("completed_at", todayEnd);

    // 检查今天是否已打卡
    const { data: existing } = await client
      .from("study_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    let checkin;
    if (existing) {
      // 更新已有记录
      const { data, error } = await client
        .from("study_checkins")
        .update({
          study_minutes: study_minutes || existing.study_minutes,
          notes_created: notesCreated || 0,
          notes_reviewed: notesReviewed || 0,
          quizzes_taken: quizzesTaken || 0,
          checkin_note: checkin_note || existing.checkin_note,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      checkin = data;
    } else {
      // 创建新打卡记录
      const { data, error } = await client
        .from("study_checkins")
        .insert({
          user_id: user.id,
          date: today,
          study_minutes: study_minutes || 0,
          notes_created: notesCreated || 0,
          notes_reviewed: notesReviewed || 0,
          quizzes_taken: quizzesTaken || 0,
          checkin_note: checkin_note || null,
        })
        .select()
        .single();
      if (error) throw error;
      checkin = data;
    }

    return NextResponse.json({ checkin, message: "打卡成功" });
  } catch (error) {
    console.error("Error creating checkin:", error);
    return NextResponse.json({ error: "打卡失败" }, { status: 500 });
  }
}
