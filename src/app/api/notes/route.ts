import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { insertNoteSchema } from "@/storage/database/shared/schema";
import { getUserFromRequest } from "@/lib/auth";
import { classifyAndUpdateNote } from "@/lib/services/subject-classification";
import { z } from "zod";

// GET /api/notes - 获取当前用户的笔记列表
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const client = getApiClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const subject = searchParams.get("subject");
    const sessionId = searchParams.get("sessionId");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    let query = client
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (subject) {
      query = query.eq("subject", subject);
    }
    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ notes: data, count: data?.length || 0 });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/notes - 创建笔记
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = insertNoteSchema.parse(body);

    const client = getApiClient();

    const { data, error } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: validatedData.title,
        content: validatedData.content,
        content_type: validatedData.contentType,
        subject: validatedData.subject,
        subject_confidence: validatedData.subject ? 1 : 0,
        subject_reason: validatedData.subject ? "用户创建笔记时指定科目。" : null,
        classified_at: validatedData.subject ? new Date().toISOString() : null,
        classification_source: validatedData.subject ? "manual" : "auto",
        source_type: validatedData.sourceType,
        source_url: validatedData.sourceUrl,
        status: validatedData.status,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!validatedData.subject) {
      const classification = await classifyAndUpdateNote(data, {
        client,
        userId: user.id,
        intent: "create_note",
      }).catch((classificationError) => {
        console.error("Error classifying created note:", classificationError);
        return null;
      });

      if (classification) {
        return NextResponse.json({
          note: {
            ...data,
            subject: classification.subject,
            subject_confidence: classification.confidence,
            subject_reason: classification.reason,
            classification_source: classification.source,
          },
        }, { status: 201 });
      }
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
