import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type StudyCheckin = {
  date: string;
  study_minutes?: number | null;
  notes_created?: number | null;
  notes_reviewed?: number | null;
  quizzes_taken?: number | null;
};

// GET /api/checkin/stats — 连续打卡天数、本周/本月统计、热力图数据
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // 获取最近 90 天打卡数据（热力图用）
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const startDate90 = ninetyDaysAgo.toISOString().split("T")[0];

    const { data: recentCheckins } = await client
      .from("study_checkins")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", startDate90)
      .lte("date", today)
      .order("date", { ascending: true });

    const checkins = (recentCheckins || []) as StudyCheckin[];

    // 计算连续打卡天数
    let streak = 0;
    const checkinDates = new Set(checkins.map((c) => c.date));
    const d = new Date(today);
    // 如果今天没有打卡，从昨天开始算
    if (!checkinDates.has(today)) {
      d.setDate(d.getDate() - 1);
    }
    while (checkinDates.has(d.toISOString().split("T")[0])) {
      streak++;
      d.setDate(d.getDate() - 1);
    }

    // 本周统计（周一开始）
    const dayOfWeek = now.getDay() || 7; // 周日=7
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const weekCheckins = checkins.filter((c) => c.date >= weekStartStr);
    const weekStudyMinutes = weekCheckins.reduce((sum, c) => sum + (c.study_minutes || 0), 0);

    // 本月统计
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthCheckins = checkins.filter((c) => c.date >= monthStart);
    const monthNotesCreated = monthCheckins.reduce((sum, c) => sum + (c.notes_created || 0), 0);
    const monthNotesReviewed = monthCheckins.reduce((sum, c) => sum + (c.notes_reviewed || 0), 0);
    const monthQuizzesTaken = monthCheckins.reduce((sum, c) => sum + (c.quizzes_taken || 0), 0);

    // 热力图数据：每天的活动强度 (0-4)
    const heatmapData = checkins.map((c) => {
      const activity = (c.notes_created || 0) + (c.notes_reviewed || 0) + (c.quizzes_taken || 0);
      let level = 0;
      if (activity >= 10) level = 4;
      else if (activity >= 6) level = 3;
      else if (activity >= 3) level = 2;
      else if (activity >= 1 || (c.study_minutes || 0) > 0) level = 1;
      return {
        date: c.date,
        level,
        studyMinutes: c.study_minutes || 0,
        notesCreated: c.notes_created || 0,
        notesReviewed: c.notes_reviewed || 0,
        quizzesTaken: c.quizzes_taken || 0,
      };
    });

    // 每日学习时长（最近 7 天，给趋势图用）
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const weeklyTrend = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];
      const dayCheckin = checkins.find((c) => c.date === dateStr);
      weeklyTrend.push({
        date: dateStr,
        dayLabel: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
        studyMinutes: dayCheckin?.study_minutes || 0,
      });
    }

    return NextResponse.json({
      streak,
      weekStudyMinutes,
      monthStats: {
        notesCreated: monthNotesCreated,
        notesReviewed: monthNotesReviewed,
        quizzesTaken: monthQuizzesTaken,
        checkinDays: monthCheckins.length,
      },
      heatmapData,
      weeklyTrend,
    });
  } catch (error) {
    console.error("Error fetching checkin stats:", error);
    return NextResponse.json({ error: "获取统计数据失败" }, { status: 500 });
  }
}
