import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/notes/[id]/feedback - 获取笔记的反馈列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const noteId = (await params).id;
  const client = getApiClient();

  const { data: feedbacks, error } = await client
    .from("knowledge_feedback")
    .select("*")
    .eq("user_id", user.id)
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ feedbacks: feedbacks || [] });
}

// POST /api/notes/[id]/feedback - 提交知识点反馈
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const noteId = (await params).id;
  const { pointIndex, action, original, corrected } = await request.json();

  // action: correct | incorrect | edited
  if (pointIndex == null || !action || !original) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const client = getApiClient();

  // 1. 写入反馈记录
  const { error: insertError } = await client
    .from("knowledge_feedback")
    .insert({
      user_id: user.id,
      note_id: noteId,
      field_type: "key_point",
      field_index: pointIndex,
      feedback: action,
      original_value: original,
      corrected_value: corrected || null,
      created_at: new Date().toISOString(),
    });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

  // 2. 如果是修正或拒绝，更新笔记中对应的 key_points
  if (action === "edited" || action === "incorrect") {
    const { data: note } = await client
      .from("notes")
      .select("key_points")
      .eq("id", noteId)
      .single();

    if (note?.key_points && Array.isArray(note.key_points)) {
      const keyPoints = [...note.key_points];
      if (pointIndex >= 0 && pointIndex < keyPoints.length) {
        const item = keyPoints[pointIndex];
        if (typeof item === "object" && item !== null && "point" in item) {
          if (action === "edited" && corrected) {
            keyPoints[pointIndex] = { ...item, point: corrected };
          } else if (action === "incorrect") {
            keyPoints[pointIndex] = { ...item, confidence: 0 };
          }
        }

        await client
          .from("notes")
          .update({
            key_points: keyPoints,
            updated_at: new Date().toISOString(),
          })
          .eq("id", noteId);
      }
    }
  }

  return NextResponse.json({ success: true });
}
