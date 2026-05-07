import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// DELETE /api/trash/[id] - 永久删除回收站内容
export async function DELETE(
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
      const { error } = await client
        .from("learning_goals")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", "archived");

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ message: "Learning space permanently deleted" });
    }

    const { error } = await client
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .not("deleted_at", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Note permanently deleted" });
  } catch (error) {
    console.error("Error permanently deleting trash item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
