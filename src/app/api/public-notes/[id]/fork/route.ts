import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type PublicNote = {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  content_type: string;
  summary: string | null;
  tags: string[] | null;
  subject: string | null;
  source_type: string;
  source_url: string | null;
  status: string;
  themes: unknown;
  key_points: unknown;
  structure: unknown;
  entities: unknown;
  metrics: unknown;
  tasks: unknown;
  timeline: unknown;
  mind_map: unknown;
  flashcards: unknown;
  comparisons: unknown;
  fork_count?: number | null;
};

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

    const { data: source, error: fetchError } = await client
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("is_public", true)
      .is("deleted_at", null)
      .single<PublicNote>();

    if (fetchError || !source) {
      return NextResponse.json({ error: fetchError?.message || "公开笔记不存在" }, { status: 404 });
    }

    if (source.user_id === user.id) {
      return NextResponse.json({ error: "不能 Fork 自己的笔记" }, { status: 400 });
    }

    const { data: forkedNote, error: insertError } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: `${source.title}（Fork）`,
        content: source.content,
        content_type: source.content_type,
        summary: source.summary,
        tags: source.tags || [],
        subject: source.subject,
        subject_confidence: source.subject ? 1 : 0,
        subject_reason: source.subject ? "Fork 公开笔记时继承原笔记学科。" : null,
        classified_at: source.subject ? new Date().toISOString() : null,
        classification_source: source.subject ? "fork" : "auto",
        source_type: source.source_type || "text",
        source_url: source.source_url,
        status: source.status || "draft",
        themes: source.themes,
        key_points: source.key_points,
        structure: source.structure,
        entities: source.entities,
        metrics: source.metrics,
        tasks: source.tasks,
        timeline: source.timeline,
        mind_map: source.mind_map,
        flashcards: source.flashcards,
        comparisons: source.comparisons,
        parent_note_id: source.id,
        is_public: false,
        fork_count: 0,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await client
      .from("notes")
      .update({ fork_count: (source.fork_count || 0) + 1 })
      .eq("id", source.id);

    return NextResponse.json({ note: forkedNote }, { status: 201 });
  } catch (error) {
    console.error("Error forking public note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
