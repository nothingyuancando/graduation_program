import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { fetchUrlContent } from "@/lib/parsers/url";
import { getUserFromRequest } from "@/lib/auth";
import { z } from "zod";

const urlUploadSchema = z.object({
  url: z.url("请输入有效的 URL"),
  title: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const validated = urlUploadSchema.parse(body);

    const { title, text } = await fetchUrlContent(validated.url);

    if (!text) {
      return NextResponse.json({ error: "未能从该 URL 提取到文本内容" }, { status: 400 });
    }

    const client = getApiClient();
    const { data, error } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: validated.title || title,
        content: text,
        content_type: "text",
        source_type: "url",
        source_url: validated.url,
        status: "draft",
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
    console.error("Error processing URL:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
