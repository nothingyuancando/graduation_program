import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// GET /api/notes/[id]/export/markdown - 导出为Markdown文件
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  
  try {
    const client = getApiClient();

    const { data: note, error } = await client
      .from("notes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // 构建完整的Markdown内容
    const frontMatter = `---
title: ${note.title}
created_at: ${note.created_at}
updated_at: ${note.updated_at}
tags: ${note.tags ? note.tags.join(", ") : ""}
source_type: ${note.source_type}
status: ${note.status}
---

`;

    let markdownContent = frontMatter;
    markdownContent += `# ${note.title}\n\n`;

    if (note.summary) {
      markdownContent += `> **摘要**：${note.summary}\n\n`;
    }

    if (note.tags && note.tags.length > 0) {
      markdownContent += `**标签**：${note.tags.map((tag: string) => `\`${tag}\``).join(" ")}\n\n`;
    }

    markdownContent += `---\n\n`;
    markdownContent += note.content;
    markdownContent += `\n\n---\n\n`;
    markdownContent += `*此笔记由智能笔记系统生成*\n`;
    
    if (note.source_url) {
      markdownContent += `*来源：${note.source_url}*\n`;
    }

    // 返回Markdown文件
    return new NextResponse(markdownContent, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(note.title)}.md"`,
      },
    });
  } catch (error) {
    console.error("Error exporting markdown:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
