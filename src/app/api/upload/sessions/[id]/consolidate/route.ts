import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { generateImportedLearningNote } from "@/lib/services/import-note";
import { getApiClient } from "@/storage/database/supabase-client";

type QueueFile = {
  id: string;
  original_file_name: string;
  category?: string | null;
  extracted_text?: string | null;
  status: string;
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isUsefulText(value?: string | null) {
  if (!value) return false;
  const text = compactText(value);
  if (text.length < 8) return false;
  return /[\u4e00-\u9fa5a-zA-Z0-9]/u.test(text);
}

function buildSourceText(files: QueueFile[]) {
  return files
    .map((file, index) => {
      const text = compactText(file.extracted_text || "");
      return [
        `## Source ${index + 1}: ${file.original_file_name}`,
        `Type: ${file.category || "text"}`,
        "",
        text,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildFlashcards(keyPoints: Array<{ point: string; sourceQuote?: string; confidence?: number }>) {
  return keyPoints.slice(0, 8).map((item, index) => ({
    question: `请解释要点 ${index + 1}：${item.point.slice(0, 60)}`,
    answer: item.sourceQuote ? `${item.point}\n\n依据：${item.sourceQuote}` : item.point,
    difficulty: 2,
  }));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const client = getApiClient();

    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "导入任务不存在" }, { status: 404 });
    }

    const { data: files, error: filesError } = await client
      .from("file_processing_queue")
      .select("id, original_file_name, category, extracted_text, status")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (filesError) {
      return NextResponse.json({ error: filesError.message }, { status: 400 });
    }

    const queueFiles = (files || []) as QueueFile[];
    const pendingCount = queueFiles.filter((file) => ["pending", "processing"].includes(file.status)).length;
    if (pendingCount > 0) {
      return NextResponse.json(
        { error: "资料还在解析中，请解析完成后再生成笔记" },
        { status: 409 }
      );
    }

    const usefulFiles = queueFiles.filter((file) => file.status === "completed" && isUsefulText(file.extracted_text));
    if (!usefulFiles.length) {
      return NextResponse.json(
        { error: "没有可用于生成笔记的文本内容", hint: "请上传 txt、md、html、pdf 或可解析的文档。" },
        { status: 400 }
      );
    }

    const title = session.title || "资料导入";
    const sourceUrl = `upload-session://${sessionId}`;
    const sourceText = buildSourceText(usefulFiles);
    const importedNote = await generateImportedLearningNote({
      title,
      sourceText,
      sourceLabel: usefulFiles.map((file) => file.original_file_name).join(", "),
      userId: user.id,
      requireLLM: true,
    });
    const flashcards = buildFlashcards(importedNote.keyPoints);
    const now = new Date().toISOString();

    const { data: existing } = await client
      .from("notes")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_url", sourceUrl)
      .is("deleted_at", null)
      .maybeSingle();

    const payload = {
      user_id: user.id,
      title,
      content: importedNote.content,
      content_type: "markdown",
      summary: importedNote.summary,
      tags: importedNote.tags,
      key_points: importedNote.keyPoints,
      mind_map: importedNote.mindMap,
      flashcards,
      source_type: "text",
      source_url: sourceUrl,
      status: "processed",
      updated_at: now,
    };

    const noteResult = existing?.id
      ? await client
          .from("notes")
          .update(payload)
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .select()
          .single()
      : await client
          .from("notes")
          .insert({ ...payload, created_at: now })
          .select()
          .single();

    if (noteResult.error || !noteResult.data) {
      return NextResponse.json({ error: noteResult.error?.message || "保存笔记失败" }, { status: 400 });
    }

    await client
      .from("upload_sessions")
      .update({
        status: "completed",
        processed_files: usefulFiles.length,
        updated_at: now,
      })
      .eq("id", sessionId)
      .eq("user_id", user.id);

    await client.from("processing_history").insert({
      session_id: sessionId,
      note_id: noteResult.data.id,
      action: "llm_consolidate",
      status: "completed",
      details: {
        mode: "llm-sync",
        totalFiles: queueFiles.length,
        usefulFiles: usefulFiles.length,
        keyPointCount: importedNote.keyPoints.length,
      },
      created_at: now,
    });

    return NextResponse.json({
      note: noteResult.data,
      message: "学习笔记已由大模型生成",
      mode: "llm-sync",
    });
  } catch (error) {
    console.error("Error consolidating upload session with LLM:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "生成学习笔记失败",
    }, { status: 500 });
  }
}
