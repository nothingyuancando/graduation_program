import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/auth";
import { getApiClient } from "@/storage/database/supabase-client";

const updateGoalSchema = z.object({
  title: z.string().min(2).max(500).optional(),
  description: z.string().max(3000).optional(),
  cognitiveLevel: z.enum(["remember", "understand", "apply", "analyze"]).optional(),
  deadline: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
  knowledgePoints: z.array(z.string()).optional(),
  dailyPlan: z.array(z.unknown()).optional(),
  progress: z.coerce.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const input = updateGoalSchema.parse(await request.json());
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.cognitiveLevel !== undefined) payload.cognitive_level = input.cognitiveLevel;
    if (input.deadline !== undefined) payload.deadline = input.deadline || null;
    if (input.status !== undefined) payload.status = input.status;
    if (input.knowledgePoints !== undefined) payload.knowledge_points = input.knowledgePoints;
    if (input.dailyPlan !== undefined) payload.daily_plan = input.dailyPlan;
    if (input.progress !== undefined) payload.progress = input.progress;

    const client = getApiClient();
    const { data, error } = await client
      .from("learning_goals")
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ goal: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error updating learning goal:", error);
    return NextResponse.json({ error: "更新学习空间失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const client = getApiClient();
    const { data, error } = await client
      .from("learning_goals")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("status", "archived")
      .select("id, title, status, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Learning space moved to trash", goal: data });
  } catch (error) {
    console.error("Error deleting learning goal:", error);
    return NextResponse.json({ error: "删除学习空间失败" }, { status: 500 });
  }
}
