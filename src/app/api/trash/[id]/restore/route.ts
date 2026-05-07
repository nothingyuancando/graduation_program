import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/trash/[id]/restore - 从回收站恢复内容
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const client = getApiClient();
    const type = new URL(request.url).searchParams.get("type");

    if (type === "learning_goal") {
      const { data, error } = await client
        .from("learning_goals")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "archived")
        .select("id, title, status")
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: "Learning space restored", goal: data });
    }

    const { data, error } = await client
      .from("notes")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .select("id, title")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Note restored", note: data });
  } catch (error) {
    console.error("Error restoring trash item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
