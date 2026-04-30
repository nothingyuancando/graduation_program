import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

function parseTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function GET(request: NextRequest) {
  try {
    const client = getApiClient();
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get("tag")?.trim();
    const subject = searchParams.get("subject")?.trim();
    const q = searchParams.get("q")?.trim().toLowerCase();
    const limit = Math.min(parseInt(searchParams.get("limit") || "60", 10), 100);

    let query = client
      .from("notes")
      .select("id,title,summary,tags,subject,source_type,status,created_at,updated_at,is_public,fork_count,user_id")
      .eq("is_public", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (subject) {
      query = query.eq("subject", subject);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const notes = (data || []).filter((note) => {
      const tags = parseTags(note.tags);
      if (tag && !tags.includes(tag)) return false;
      if (!q) return true;
      return (
        note.title?.toLowerCase().includes(q) ||
        note.summary?.toLowerCase().includes(q) ||
        note.subject?.toLowerCase().includes(q) ||
        tags.some((item) => item.toLowerCase().includes(q))
      );
    });

    const tags = Array.from(
      new Set(notes.flatMap((note) => parseTags(note.tags)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));

    const subjects = Array.from(
      new Set(notes.map((note) => note.subject).filter((item): item is string => Boolean(item)))
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));

    return NextResponse.json({ notes, tags, subjects });
  } catch (error) {
    console.error("Error fetching public notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
