import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// GET /api/upload/sessions/[id] - 获取上传会话详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getApiClient();

    // 获取会话信息
    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .select("*")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 获取文件处理队列
    const { data: files, error: filesError } = await client
      .from("file_processing_queue")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (filesError) {
      return NextResponse.json({ error: filesError.message }, { status: 400 });
    }

    // 获取处理历史
    const { data: history } = await client
      .from("processing_history")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: false });

    const { data: latestGenerationJob } = await client
      .from("generation_jobs")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 计算统计信息
    const stats = {
      total: files?.length || 0,
      pending: files?.filter((f) => f.status === "pending").length || 0,
      processing: files?.filter((f) => f.status === "processing").length || 0,
      completed: files?.filter((f) => f.status === "completed").length || 0,
      failed: files?.filter((f) => f.status === "failed").length || 0,
      byCategory:
        files?.reduce(
          (acc, f) => {
            const cat = f.category || "other";
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {},
    };

    return NextResponse.json({
      session,
      files,
      history,
      latestGenerationJob,
      stats,
    });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
