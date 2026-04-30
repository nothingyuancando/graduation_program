import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// GET /api/notes/[id]/entities - 获取笔记的实体
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = getApiClient();

    const { data, error } = await client
      .from("note_entities")
      .select("*")
      .eq("note_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ entities: data || [] });
  } catch (error) {
    console.error("Error fetching entities:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
