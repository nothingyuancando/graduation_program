import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type NoteRelationship = {
  to_note_id: string;
  confidence: string | number;
};

type RelatedNote = {
  id: string;
  title: string;
  tags?: string[] | null;
  summary?: string | null;
  updated_at?: string | null;
};

// GET /api/notes/[id]/related — 获取已计算的相关笔记
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();

    // 获取从该笔记出发的 similar 关系
    const { data: relationships, error } = await client
      .from("note_relationships")
      .select("to_note_id, confidence")
      .eq("from_note_id", id)
      .eq("relationship_type", "similar")
      .order("confidence", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!relationships || relationships.length === 0) {
      return NextResponse.json({ related: [] });
    }

    // 获取相关笔记的详细信息
    const typedRelationships = relationships as NoteRelationship[];
    const noteIds = typedRelationships.map((r) => r.to_note_id);
    const { data: notes } = await client
      .from("notes")
      .select("id, title, tags, summary, updated_at")
      .in("id", noteIds)
      .eq("user_id", user.id)
      .is("deleted_at", null);

    // 合并相似度信息
    const related = ((notes || []) as RelatedNote[]).map((note) => {
      const rel = typedRelationships.find((r) => r.to_note_id === note.id);
      return {
        ...note,
        similarity: rel ? parseFloat(String(rel.confidence)) : 0,
      };
    }).sort((a, b) => b.similarity - a.similarity);

    return NextResponse.json({ related });
  } catch (error) {
    console.error("Error fetching related notes:", error);
    return NextResponse.json({ error: "获取相关笔记失败" }, { status: 500 });
  }
}
