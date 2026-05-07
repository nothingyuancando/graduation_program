import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient, LLMClient } from "@/lib/llm-provider";
import { getStorageConfig } from "@/lib/env-utils";
import { createS3Client, S3ClientInstance } from "@/lib/storage/s3";
import { parsePdf } from "@/lib/parsers/pdf";
import { isDocxFile, isLegacyDocFile, parseDocx } from "@/lib/parsers/docx";
import { fetchUrlContent } from "@/lib/parsers/url";
import { getUserFromRequest } from "@/lib/auth";

const FILE_PROCESSING_BATCH_SIZE = Math.max(1, Math.min(Number(process.env.FILE_PROCESSING_BATCH_SIZE || 3), 10));

type ProcessingFile = {
  id: string;
  original_file_name: string;
  file_key: string;
  file_type: string;
  category?: string | null;
  extracted_text?: string | null;
};

type LLMImageMessage = {
  role: "user";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  >;
};

/** 处理文本/PDF 类文件 */
async function processTextFile(
  file: ProcessingFile,
  storage: S3ClientInstance | null
): Promise<string> {
  // URL 类文件
  if (file.file_key.startsWith("http")) {
    const { text } = await fetchUrlContent(file.file_key);
    return text;
  }

  // 本地暂存（未配置存储时）
  if (file.file_key.startsWith("local:")) {
    return file.extracted_text || `[本地文件：${file.original_file_name}，需配置对象存储才能处理]`;
  }

  if (!storage) {
    return `[文件：${file.original_file_name}，需配置对象存储才能处理]`;
  }

  // 从 S3 下载并解析
  const buffer = await storage.downloadFile(file.file_key);

  if (file.file_type === "application/pdf") {
    return parsePdf(buffer);
  }

  if (isDocxFile(file.original_file_name, file.file_type)) {
    return parseDocx(buffer);
  }

  if (isLegacyDocFile(file.original_file_name, file.file_type)) {
    return `[Word 97-2003 文件：${file.original_file_name}，暂不支持 .doc 二进制格式，请另存为 .docx 后重新上传]`;
  }

  // 纯文本、Markdown、HTML 等直接读取
  return buffer.toString("utf-8");
}

/** 处理图片类文件 */
async function processImageFile(
  file: ProcessingFile,
  storage: S3ClientInstance | null,
  llmClient: LLMClient
): Promise<string> {
  if (!storage) {
    return `[图片文件：${file.original_file_name}，需配置对象存储才能处理]`;
  }

  const imageUrl = await storage.generatePresignedUrl({
    key: file.file_key,
    expireTime: 3600,
  });

  const response = await llmClient.invoke(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "请详细描述这张图片的内容。如果图片中有文字，请完整提取；如果有图表，请描述图表内容；如果是截图，请说明类型和内容。",
          },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      } as LLMImageMessage,
    ],
    { temperature: 0.3 }
  );

  return response.content;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = (await params).id;
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const client = getApiClient();

    await client
      .from("upload_sessions")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    const { data: files, error: filesError } = await client
      .from("file_processing_queue")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "pending")
      .limit(FILE_PROCESSING_BATCH_SIZE);

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ message: "没有待处理的文件", processedCount: 0 });
    }

    const storageConfig = getStorageConfig();
    const storage = storageConfig ? createS3Client(storageConfig) : null;
    const llmClient = createLLMClient({ userId: user.id });

    const results = [];
    let processedCount = 0;

    for (const file of files) {
      try {
        await client
          .from("file_processing_queue")
          .update({ status: "processing", processed_at: new Date().toISOString() })
          .eq("id", file.id);

        let extractedText = "";

        switch (file.category) {
          case "text":
          case "presentation":
          case "spreadsheet":
            extractedText = await processTextFile(file, storage);
            break;
          case "image":
            extractedText = await processImageFile(file, storage, llmClient);
            break;
          case "audio":
            extractedText = `[音频文件：${file.original_file_name}，暂不支持音频解析]`;
            break;
          case "video":
            extractedText = `[视频文件：${file.original_file_name}，暂不支持视频解析]`;
            break;
          case "archive":
            extractedText = `[压缩包：${file.original_file_name}，请解压后重新上传]`;
            break;
          default:
            extractedText = await processTextFile(file, storage);
        }

        await client
          .from("file_processing_queue")
          .update({
            status: "completed",
            extracted_text: extractedText,
            processed_at: new Date().toISOString(),
          })
          .eq("id", file.id);

        results.push({
          fileId: file.id,
          fileName: file.original_file_name,
          category: file.category,
          status: "completed",
          textLength: extractedText.length,
        });

        processedCount++;

        await client
          .from("upload_sessions")
          .update({ processed_files: processedCount, updated_at: new Date().toISOString() })
          .eq("id", sessionId);
      } catch (fileError) {
        console.error(`Error processing file ${file.id}:`, fileError);

        await client
          .from("file_processing_queue")
          .update({
            status: "failed",
            error_message: fileError instanceof Error ? fileError.message : "未知错误",
            processed_at: new Date().toISOString(),
          })
          .eq("id", file.id);

        results.push({
          fileId: file.id,
          fileName: file.original_file_name,
          status: "failed",
          error: fileError instanceof Error ? fileError.message : "未知错误",
        });
      }
    }

    const { count: completedCount } = await client
      .from("file_processing_queue")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("status", "completed");

    await client
      .from("upload_sessions")
      .update({ processed_files: completedCount || processedCount, updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    await client.from("processing_history").insert({
      session_id: sessionId,
      action: "extract",
      status: "completed",
      details: { totalFiles: files.length, processed: processedCount, failed: files.length - processedCount },
      created_at: new Date().toISOString(),
    });

    // 检查是否还有待处理文件
    const { data: remaining } = await client
      .from("file_processing_queue")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "pending");

    if (!remaining || remaining.length === 0) {
      await client
        .from("upload_sessions")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }

    return NextResponse.json({ message: "处理完成", sessionId, processedCount, results });
  } catch (error) {
    console.error("Error processing files:", error);
    try {
      const client = getApiClient();
      await client
        .from("upload_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    } catch {}
    return NextResponse.json({ error: "文件处理失败" }, { status: 500 });
  }
}
