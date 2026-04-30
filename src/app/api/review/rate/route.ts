import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// SM-2 算法
function sm2(quality: number, repetitions: number, easeFactor: number, intervalDays: number) {
  let newEase = easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  newEase = Math.max(1.3, newEase);

  let newReps = repetitions;
  let newInterval: number;

  if (quality >= 3) {
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(intervalDays * newEase);
    newReps = repetitions + 1;
  } else {
    newReps = 0;
    newInterval = 1;
  }

  const dueDate = new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000).toISOString();
  return { newEase, newReps, newInterval, dueDate };
}

// POST /api/review/rate - 提交复习评分
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { cardId, quality } = await request.json();
  // quality: 1=完全忘记 2=困难 3=还行 4=简单 5=非常简单
  if (!cardId || quality == null || quality < 1 || quality > 5) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const client = getApiClient();
  const { data: card, error: fetchErr } = await client
    .from("flashcard_reviews")
    .select("ease_factor, interval_days, repetitions")
    .eq("id", cardId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !card) return NextResponse.json({ error: "卡片不存在" }, { status: 404 });

  const { newEase, newReps, newInterval, dueDate } = sm2(
    quality,
    card.repetitions,
    card.ease_factor,
    card.interval_days
  );

  const { error: updateErr } = await client
    .from("flashcard_reviews")
    .update({
      ease_factor: newEase,
      repetitions: newReps,
      interval_days: newInterval,
      due_date: dueDate,
      last_reviewed: new Date().toISOString(),
    })
    .eq("id", cardId)
    .eq("user_id", user.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  return NextResponse.json({ nextDue: dueDate, intervalDays: newInterval });
}
