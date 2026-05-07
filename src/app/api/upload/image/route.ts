import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getStorageConfig } from "@/lib/env-utils";
import { createLLMClient } from "@/lib/llm-provider";
import { createS3Client } from "@/lib/storage/s3";
import { getUserFromRequest } from "@/lib/auth";
import { generateImportedLearningNote } from "@/lib/services/import-note";

type LLMImageMessage = {
  role: "user";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  >;
};

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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "请上传图片文件" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const storageConfig = getStorageConfig();

    let fileKey: string;
    let imageUrl: string;

    if (storageConfig) {
      const storage = createS3Client(storageConfig);
      fileKey = await storage.uploadFile({
        fileContent: fileBuffer,
        fileName: `images/${user.id}/${Date.now()}_${file.name}`,
        contentType: file.type,
      });
      imageUrl = await storage.generatePresignedUrl({ key: fileKey, expireTime: 86400 * 7 });
    } else {
      // 未配置存储时使用 base64
      const base64 = fileBuffer.toString("base64");
      fileKey = `base64:${file.name}`;
      imageUrl = `data:${file.type};base64,${base64}`;
    }

    // 调用视觉模型理解图片内容
    const llmClient = createLLMClient({ userId: user.id });
    const response = await llmClient.invoke(
      [
        {
          role: "user",
          content: [
            { type: "text", text: "请详细描述这张图片的内容，包括主要元素、颜色、场景、文字等。" },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        } as LLMImageMessage,
      ],
      { temperature: 0.7 }
    );

    const noteTitle = title || file.name;
    const importedNote = await generateImportedLearningNote({
      title: noteTitle,
      sourceText: response.content,
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
        source_type: "image",
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

    return NextResponse.json({ note: data, imageUrl }, { status: 201 });
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
