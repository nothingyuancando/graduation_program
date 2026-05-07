import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";

const goalSchema = z.object({
  title: z.string().min(2).max(500),
  description: z.string().max(3000).optional().default(""),
  cognitiveLevel: z.enum(["remember", "understand", "apply", "analyze"]).default("understand"),
  deadline: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "paused", "archived"]).default("active"),
  knowledgePoints: z.array(z.string()).default([]),
  dailyPlan: z.array(z.unknown()).default([]),
  progress: z.coerce.number().int().min(0).max(100).default(0),
});

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getApiClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const includeArchived = searchParams.get("includeArchived") === "true";

  let query = client
    .from("learning_goals")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else if (!includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ goals: data || [] });
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = goalSchema.parse(body);
    const client = getApiClient();
    const now = new Date().toISOString();

    const { data, error } = await client
      .from("learning_goals")
      .insert({
        user_id: user.id,
        title: input.title,
        description: input.description,
        cognitive_level: input.cognitiveLevel,
        deadline: input.deadline || null,
        status: input.status,
        knowledge_points: input.knowledgePoints,
        daily_plan: input.dailyPlan,
        progress: input.progress,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error creating learning goal:", error);
    return NextResponse.json({ error: "创建学习目标失败" }, { status: 500 });
  }
}
