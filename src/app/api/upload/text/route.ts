import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";
import { generateImportedLearningNote } from "@/lib/services/import-note";
import { z } from "zod";

const textUploadSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  contentType: z.enum(["text", "markdown"]).default("text"),
});

// POST /api/upload/text - 处理文本输入
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();

    // 验证请求数据
    const validatedData = textUploadSchema.parse(body);

    const client = getApiClient();
    const importedNote = await generateImportedLearningNote({
      title: validatedData.title,
      sourceText: validatedData.content,
      sourceLabel: "粘贴文本",
      userId: user.id,
    });

    // 创建笔记
    const { data, error } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: validatedData.title,
        content: importedNote.content,
        content_type: "markdown",
        summary: importedNote.summary,
        tags: importedNote.tags,
        key_points: importedNote.keyPoints,
        mind_map: importedNote.mindMap,
        source_type: "text",
        status: "processed",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error("Error processing text:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
