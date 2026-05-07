import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getStorageConfig } from "@/lib/env-utils";
import { parseDocx, isDocxFile, isLegacyDocFile } from "@/lib/parsers/docx";
import { parsePdf } from "@/lib/parsers/pdf";
import { createS3Client } from "@/lib/storage/s3";
import { getApiClient } from "@/storage/database/supabase-client";

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
  ) {
    return "text";
  }
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")) {
    return "presentation";
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv")) {
    return "spreadsheet";
  }
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed") || lowerName.endsWith(".zip") || lowerName.endsWith(".rar") || lowerName.endsWith(".7z")) {
    return "archive";
  }
  return "other";
}

async function extractInlineText(file: File, fileBuffer: Buffer) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return parsePdf(fileBuffer);
  }

  if (isDocxFile(file.name, file.type)) {
    return parseDocx(fileBuffer);
  }

  if (isLegacyDocFile(file.name, file.type)) {
    return `[Word 97-2003 文件：${file.name}。暂不支持 .doc 二进制格式，请另存为 .docx 后重新上传。]`;
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
    const title = (formData.get("title") as string) || "资料导入";
    const urls = ((formData.get("urls") as string) || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (files.length === 0 && urls.length === 0) {
      return NextResponse.json({ error: "请至少选择一个文件或添加一个网页链接" }, { status: 400 });
    }

    const client = getApiClient();
    const storageConfig = getStorageConfig();
    const storage = storageConfig ? createS3Client(storageConfig) : null;

    const { data: userRow } = await client.from("users").select("id").eq("id", user.id).single();
    if (!userRow) {
      return NextResponse.json({ error: "用户不存在，请重新登录" }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .insert({
        user_id: user.id,
        title,
        status: "pending",
        total_files: files.length + urls.length,
        processed_files: 0,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "创建导入任务失败", detail: sessionError?.message }, { status: 500 });
    }

    const fileQueueItems = [];

    for (const file of files) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const inlineText = storage ? null : await extractInlineText(file, fileBuffer);
      const fileKey = storage
        ? await storage.uploadFile({
            fileContent: fileBuffer,
            fileName: `uploads/${user.id}/${session.id}/${Date.now()}_${file.name}`,
            contentType: file.type,
          })
        : `local:${file.name}`;

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

    const { error: queueError } = await client.from("file_processing_queue").insert(fileQueueItems);
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
      message: "导入任务已创建",
      stats: {
        totalFiles: files.length + urls.length,
        storageMode: storage ? "s3" : "local",
      },
      warning: storage ? undefined : "未配置对象存储，文件会以本地解析结果进入队列。生产环境建议配置 S3。",
    });
  } catch (error) {
    console.error("Error in batch upload:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "服务器内部错误", detail }, { status: 500 });
  }
}
