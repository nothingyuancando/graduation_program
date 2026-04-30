import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// GET /api/notes/[id]/export/html - 导出为HTML
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

    // 获取实体
    const { data: entities } = await client
      .from("note_entities")
      .select("*")
      .eq("note_id", id);

    // 生成HTML内容
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${note.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1 {
            color: #1a1a1a;
            border-bottom: 2px solid #4a90e2;
            padding-bottom: 0.5rem;
        }
        h2 {
            color: #2c3e50;
            margin-top: 2rem;
            border-left: 4px solid #4a90e2;
            padding-left: 1rem;
        }
        h3 {
            color: #34495e;
        }
        .metadata {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        .metadata p {
            margin: 0.5rem 0;
        }
        .tags {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-top: 1rem;
        }
        .tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 0.25rem 0.75rem;
            border-radius: 16px;
            font-size: 0.875rem;
        }
        .summary {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 1rem;
            margin: 1.5rem 0;
            font-style: italic;
        }
        .entities {
            background: #f3e5f5;
            padding: 1rem;
            border-radius: 8px;
            margin-top: 2rem;
        }
        .entity-item {
            padding: 0.5rem;
            border-bottom: 1px solid #e1bee7;
        }
        .entity-item:last-child {
            border-bottom: none;
        }
        .content {
            white-space: pre-wrap;
            font-size: 1rem;
            line-height: 1.8;
        }
        .footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #ddd;
            font-size: 0.875rem;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>${note.title}</h1>

    <div class="metadata">
        <p><strong>来源：</strong>${note.source_type}</p>
        <p><strong>创建时间：</strong>${note.created_at}</p>
        <p><strong>更新时间：</strong>${note.updated_at}</p>
        ${note.tags && note.tags.length > 0 ? `
        <div class="tags">
            ${note.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        ` : ""}
    </div>

    ${note.summary ? `
    <div class="summary">
        <strong>摘要：</strong>${note.summary}
    </div>
    ` : ""}

    <div class="content">
        ${note.content}
    </div>

    ${entities && entities.length > 0 ? `
    <div class="entities">
        <h3>提取的实体</h3>
        ${entities.map((entity) => `
        <div class="entity-item">
            <strong>${entity.entity_name}</strong> <span style="color: #666;">(${entity.entity_type})</span>
            ${entity.description ? `: ${entity.description}` : ""}
        </div>
        `).join("")}
    </div>
    ` : ""}

    <div class="footer">
        <p>由智能笔记系统生成</p>
        ${note.source_url ? `<p>来源: ${note.source_url}</p>` : ""}
    </div>
</body>
</html>`;

    // 返回HTML文件
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(note.title)}.html"`,
      },
    });
  } catch (error) {
    console.error("Error exporting HTML:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
