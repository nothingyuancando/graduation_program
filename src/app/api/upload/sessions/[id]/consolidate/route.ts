import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createGenerationJob } from "@/lib/generation-jobs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const job = await createGenerationJob({ sessionId, userId: user.id });

    return NextResponse.json({
      job,
      jobId: job.id,
      message: "已创建异步笔记生成任务，请启动 pnpm worker 后等待任务完成。",
    }, { status: 202 });
  } catch (error) {
    console.error("Error creating generation job:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "创建生成任务失败",
    }, { status: 400 });
  }
}
