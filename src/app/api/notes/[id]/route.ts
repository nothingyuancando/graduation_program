import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { updateNoteSchema } from "@/storage/database/shared/schema";
import { getUserFromRequest } from "@/lib/auth";
import { classifyAndUpdateNote } from "@/lib/services/subject-classification";
import { z } from "zod";

export async function GET(
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

    const { data, error } = await client
      .from("notes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateNoteSchema.parse(body);
    const client = getApiClient();

    const manualSubject = typeof validatedData.subject === "string" && validatedData.subject.trim().length > 0;
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validatedData.title !== undefined) updatePayload.title = validatedData.title;
    if (validatedData.content !== undefined) updatePayload.content = validatedData.content;
    if (validatedData.contentType !== undefined) updatePayload.content_type = validatedData.contentType;
    if (validatedData.summary !== undefined) updatePayload.summary = validatedData.summary;
    if (validatedData.tags !== undefined) updatePayload.tags = validatedData.tags;
    if (validatedData.subject !== undefined) updatePayload.subject = validatedData.subject;
    if (validatedData.status !== undefined) updatePayload.status = validatedData.status;
    if (validatedData.isPublic !== undefined) updatePayload.is_public = validatedData.isPublic;

    if (manualSubject) {
      updatePayload.subject_confidence = 1;
      updatePayload.subject_reason = "用户手动修改科目。";
      updatePayload.classified_at = new Date().toISOString();
      updatePayload.classification_source = "manual";
    }

    const { data, error } = await client
      .from("notes")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!manualSubject && (validatedData.title || validatedData.content || validatedData.tags)) {
      await classifyAndUpdateNote(data, {
        client,
        userId: user.id,
        intent: "update_note",
      }).catch((classificationError) => {
        console.error("Error classifying updated note:", classificationError);
      });
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error updating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await client
      .from("notes")
      .update({ deleted_at: new Date().toISOString(), is_public: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Note moved to trash" });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
