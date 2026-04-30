import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/trash - 获取回收站笔记（同时清理超过7天的）
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const client = getApiClient();

    // 先清理超过 7 天的笔记（硬删除）
    const expiry = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await client
      .from("notes")
      .delete()
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .lt("deleted_at", expiry);

    // 返回回收站中剩余的笔记
    const { data, error } = await client
      .from("notes")
      .select("id, title, summary, tags, source_type, status, deleted_at, updated_at")
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ notes: data });
  } catch (error) {
    console.error("Error fetching trash:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
