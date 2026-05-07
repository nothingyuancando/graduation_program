import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getStorageConfig } from "@/lib/env-utils";
import { createS3Client } from "@/lib/storage/s3";
import { parsePdf } from "@/lib/parsers/pdf";
import { getUserFromRequest } from "@/lib/auth";
import { generateImportedLearningNote } from "@/lib/services/import-note";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "未提供文件" }, { status: 400 });
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "请上传 PDF 文件" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 直接在服务端解析 PDF，无需上传再解析
    const textContent = await parsePdf(fileBuffer);

    // 如果配置了对象存储，同时上传原文件备份
    let fileKey = `local:${file.name}`;
    const storageConfig = getStorageConfig();
    if (storageConfig) {
      const storage = createS3Client(storageConfig);
      fileKey = await storage.uploadFile({
        fileContent: fileBuffer,
        fileName: `pdfs/${user.id}/${Date.now()}_${file.name}`,
        contentType: file.type,
      });
    }

    const noteTitle = title || file.name.replace(/\.pdf$/i, "");
    const importedNote = await generateImportedLearningNote({
      title: noteTitle,
      sourceText: textContent || "",
      sourceLabel: file.name,
      userId: user.id,
    });

    const client = getApiClient();
    const { data, error } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: noteTitle,
        content: importedNote.content,
        content_type: "markdown",
        summary: importedNote.summary,
        tags: importedNote.tags,
        key_points: importedNote.keyPoints,
        mind_map: importedNote.mindMap,
        source_type: "pdf",
        source_url: fileKey,
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
    console.error("Error processing PDF:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
