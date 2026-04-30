import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";
import { classifyNoteById } from "@/lib/services/subject-classification";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const client = getApiClient();

  try {
    const classification = await classifyNoteById(id, {
      client,
      userId: user.id,
      force: body.force !== false,
    });

    return NextResponse.json({ classification });
  } catch (error) {
    console.error("Error classifying note:", error);
    return NextResponse.json({ error: "Failed to classify note" }, { status: 500 });
  }
}
