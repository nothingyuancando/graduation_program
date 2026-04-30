import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getStorageConfig } from "@/lib/env-utils";
import { createS3Client } from "@/lib/storage/s3";
import { getUserFromRequest } from "@/lib/auth";
import { parsePdf } from "@/lib/parsers/pdf";
import { isDocxFile, isLegacyDocFile, parseDocx } from "@/lib/parsers/docx";

function classifyFile(mimeType: string, fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/html" ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".html")
  ) return "text";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint") ||
    fileName.endsWith(".ppt") || fileName.endsWith(".pptx")) return "presentation";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") ||
    mimeType.includes("csv") || fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx") || fileName.endsWith(".csv")) return "spreadsheet";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("zip") || mimeType.includes("rar") ||
    mimeType.includes("compressed") || fileName.endsWith(".zip") ||
    fileName.endsWith(".rar") || fileName.endsWith(".7z")) return "archive";
  return "other";
}

async function extractInlineText(file: File, fileBuffer: Buffer) {
  if (file.type === "application/pdf") {
    return parsePdf(fileBuffer);
  }

  if (isDocxFile(file.name, file.type)) {
    return parseDocx(fileBuffer);
  }

  if (isLegacyDocFile(file.name, file.type)) {
    return `[Word 97-2003 文件：${file.name}，暂不支持 .doc 二进制格式，请另存为 .docx 后重新上传]`;
  }

  if (
    file.type === "text/plain" ||
    file.type === "text/markdown" ||
    file.type === "text/html" ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".html")
  ) {
    return fileBuffer.toString("utf-8");
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const title = (formData.get("title") as string) || "未整理笔记";
    const urls = (formData.get("urls") as string)?.split(",").filter(Boolean) || [];

    if (files.length === 0 && urls.length === 0) {
      return NextResponse.json({ error: "未提供文件或 URL" }, { status: 400 });
    }

    const client = getApiClient();
    const storageConfig = getStorageConfig();
    const storage = storageConfig ? createS3Client(storageConfig) : null;

    // 验证 user_id 在 users 表中实际存在（防止旧 JWT 对应已删除的用户）
    const { data: userRow } = await client
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();
    if (!userRow) {
      return NextResponse.json({ error: "用户不存在，请重新登录" }, { status: 401 });
    }

    // 创建上传会话
    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .insert({
        user_id: user.id,
        title,
        status: "pending",
        total_files: files.length + urls.length,
        processed_files: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "创建上传会话失败", detail: sessionError?.message }, { status: 500 });
    }

    const fileQueueItems = [];

    // 处理文件
    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      let fileKey: string;

      const inlineText = storage ? null : await extractInlineText(file, fileBuffer);

      if (storage) {
        fileKey = await storage.uploadFile({
          fileContent: fileBuffer,
          fileName: `uploads/${user.id}/${session.id}/${Date.now()}_${file.name}`,
          contentType: file.type,
        });
      } else {
        fileKey = `local:${file.name}`;
      }

      fileQueueItems.push({
        session_id: session.id,
        original_file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        category: classifyFile(file.type, file.name),
        file_key: fileKey,
        extracted_text: inlineText,
        status: "pending",
        created_at: new Date().toISOString(),
      });
    }

    // 处理 URL
    for (const url of urls) {
      fileQueueItems.push({
        session_id: session.id,
        original_file_name: url.substring(0, 100),
        file_size: 0,
        file_type: "text/html",
        category: "text",
        file_key: url,
        status: "pending",
        created_at: new Date().toISOString(),
      });
    }

    const { error: queueError } = await client
      .from("file_processing_queue")
      .insert(fileQueueItems);

    if (queueError) {
      return NextResponse.json({ error: "创建处理队列失败", detail: queueError.message }, { status: 500 });
    }

    await client.from("processing_history").insert({
      session_id: session.id,
      action: "upload",
      status: "completed",
      details: {
        totalFiles: files.length,
        totalUrls: urls.length,
        storageMode: storage ? "s3" : "local",
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      session,
      message: "上传成功",
      stats: {
        totalFiles: files.length + urls.length,
        storageMode: storage ? "s3" : "local",
      },
      warning: storage ? undefined : "未配置对象存储，文件暂存本地，请配置 S3_BUCKET_ENDPOINT_URL 和 S3_BUCKET_NAME 后重新上传以启用完整处理。",
    });
  } catch (error) {
    console.error("Error in batch upload:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "服务器内部错误", detail: msg }, { status: 500 });
  }
}
