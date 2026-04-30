import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// DELETE /api/trash/[id] - 永久删除回收站中的笔记
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
    console.error("Error permanently deleting note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
