import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const client = getApiClient();
  const { data, error } = await client
    .from("notes")
    .select("subject, subject_confidence, updated_at")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const subjects = new Map<string, { subject: string; count: number; lowConfidence: number; latestUpdatedAt: string | null }>();

  for (const note of data || []) {
    const subject = note.subject || "未分类";
    const current = subjects.get(subject) || {
      subject,
      count: 0,
      lowConfidence: 0,
      latestUpdatedAt: null,
    };

    current.count += 1;
    if (Number(note.subject_confidence || 0) < 0.75) {
      current.lowConfidence += 1;
    }
    if (!current.latestUpdatedAt || (note.updated_at || "") > current.latestUpdatedAt) {
      current.latestUpdatedAt = note.updated_at;
    }
    subjects.set(subject, current);
  }

  return NextResponse.json({
    subjects: [...subjects.values()].sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)),
  });
}
