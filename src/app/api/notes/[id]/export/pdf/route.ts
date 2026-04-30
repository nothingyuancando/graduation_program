import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

type NoteEntity = {
  entity_type: string;
  entity_name: string;
  description?: string | null;
};

type NoteTask = {
  status?: string;
  content?: string;
  assignee?: string;
  deadline?: string;
};

// GET /api/notes/[id]/export/pdf - 导出为PDF格式（返回可打印的HTML）
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

    // 获取实体信息
    const { data: entities } = await client
      .from("note_entities")
      .select("*")
      .eq("note_id", id);

    // 格式化标签
    const tagsHtml = note.tags && note.tags.length > 0
      ? note.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join("")
      : '<span class="tag">无标签</span>';

    // 格式化实体
    const entitiesHtml = entities && entities.length > 0
      ? (entities as NoteEntity[]).map((entity) => `
        <div class="entity-item">
          <span class="entity-type">${getEntityLabel(entity.entity_type)}</span>
          <span class="entity-name">${entity.entity_name}</span>
          ${entity.description ? `<span class="entity-desc">${entity.description}</span>` : ""}
        </div>
      `).join("")
      : '<p class="no-data">暂无提取的实体</p>';

    // 格式化任务
    const tasksHtml = note.tasks && Array.isArray(note.tasks) && note.tasks.length > 0
      ? (note.tasks as NoteTask[]).map((task) => `
        <div class="task-item">
          <input type="checkbox" ${task.status === "completed" ? "checked" : ""} disabled>
          <span class="task-content">${task.content}</span>
          ${task.assignee ? `<span class="task-assignee">负责人：${task.assignee}</span>` : ""}
          ${task.deadline ? `<span class="task-deadline">截止：${task.deadline}</span>` : ""}
        </div>
      `).join("")
      : "";

    // 将Markdown内容转换为HTML（简单的转换）
    const contentHtml = markdownToHtml(note.content);

    // 生成可打印的HTML
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${note.title}</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            line-height: 1.8;
            color: #1a1a1a;
            max-width: 210mm;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
            margin-bottom: 30px;
        }
        
        .title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 10px 0;
        }
        
        .meta {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
        }
        
        .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin-top: 15px;
        }
        
        .tag {
            display: inline-block;
            background: #e0e7ff;
            color: #3730a3;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
        }
        
        .summary {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            padding: 15px 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        
        .summary-title {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
        }
        
        .content {
            margin: 30px 0;
        }
        
        .content h1 {
            font-size: 22px;
            color: #1e40af;
            border-bottom: 1px solid #dbeafe;
            padding-bottom: 8px;
            margin-top: 30px;
        }
        
        .content h2 {
            font-size: 18px;
            color: #1e3a8a;
            margin-top: 25px;
            border-left: 3px solid #3b82f6;
            padding-left: 12px;
        }
        
        .content h3 {
            font-size: 16px;
            color: #1e40af;
            margin-top: 20px;
        }
        
        .content p {
            margin: 12px 0;
            text-align: justify;
        }
        
        .content ul, .content ol {
            margin: 12px 0;
            padding-left: 24px;
        }
        
        .content li {
            margin: 6px 0;
        }
        
        .content blockquote {
            border-left: 3px solid #6366f1;
            padding: 10px 15px;
            margin: 15px 0;
            background: #f8fafc;
            color: #475569;
        }
        
        .content code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
        }
        
        .content pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 13px;
        }
        
        .content pre code {
            background: transparent;
            padding: 0;
        }
        
        .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        
        .content th, .content td {
            border: 1px solid #e2e8f0;
            padding: 10px;
            text-align: left;
        }
        
        .content th {
            background: #f8fafc;
            font-weight: 600;
        }
        
        .section {
            margin: 30px 0;
            padding: 20px;
            border-radius: 8px;
            page-break-inside: avoid;
        }
        
        .entities-section {
            background: #f0fdf4;
            border: 1px solid #86efac;
        }
        
        .tasks-section {
            background: #fef2f2;
            border: 1px solid #fca5a5;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .entity-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: white;
            border-radius: 6px;
            margin: 8px 0;
        }
        
        .entity-type {
            background: #dbeafe;
            color: #1e40af;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
        }
        
        .entity-name {
            font-weight: 500;
        }
        
        .entity-desc {
            color: #666;
            font-size: 13px;
        }
        
        .task-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: white;
            border-radius: 6px;
            margin: 8px 0;
        }
        
        .task-item input[type="checkbox"] {
            width: 16px;
            height: 16px;
        }
        
        .task-content {
            flex: 1;
        }
        
        .task-assignee, .task-deadline {
            font-size: 12px;
            color: #666;
        }
        
        .no-data {
            color: #999;
            font-style: italic;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        @media print {
            body {
                padding: 0;
            }
            
            .section {
                page-break-inside: avoid;
            }
            
            .no-print {
                display: none !important;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${note.title}</h1>
        <div class="meta">
            创建时间：${new Date(note.created_at).toLocaleString("zh-CN")} | 
            更新时间：${new Date(note.updated_at).toLocaleString("zh-CN")}
        </div>
        <div class="tags">
            ${tagsHtml}
        </div>
    </div>

    ${note.summary ? `
    <div class="summary">
        <div class="summary-title">📋 内容概述</div>
        <p style="margin: 0;">${note.summary}</p>
    </div>
    ` : ""}

    <div class="content">
        ${contentHtml}
    </div>

    ${entities && entities.length > 0 ? `
    <div class="section entities-section">
        <div class="section-title">🏷️ 关键实体</div>
        ${entitiesHtml}
    </div>
    ` : ""}

    ${note.tasks && Array.isArray(note.tasks) && note.tasks.length > 0 ? `
    <div class="section tasks-section">
        <div class="section-title">✅ 待办事项</div>
        ${tasksHtml}
    </div>
    ` : ""}

    <div class="footer">
        <p>由智能笔记系统生成 | ${new Date().toLocaleDateString("zh-CN")}</p>
        ${note.source_url ? `<p>来源：${note.source_url}</p>` : ""}
    </div>

    <script>
        // 页面加载完成后自动触发打印对话框
        window.onload = function() {
            // 延迟触发打印，确保内容已完全加载
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>`;

    // 返回HTML（用户可以在浏览器中打印为PDF）
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error exporting PDF:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// 获取实体类型标签
function getEntityLabel(type: string): string {
  const labels: Record<string, string> = {
    person: "人物",
    organization: "组织",
    location: "地点",
    date: "日期",
    number: "数值",
    task: "任务",
    concept: "概念",
    other: "其他",
  };
  return labels[type] || type;
}

// 简单的Markdown转HTML函数
function markdownToHtml(markdown: string): string {
  if (!markdown) return "";
  
  let html = markdown;
  
  // 转义HTML特殊字符（但保留我们要处理的Markdown语法）
  // html = html.replace(/&/g, '&amp;');
  
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // 粗体和斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  
  // 无序列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // 水平线
  html = html.replace(/^---$/gm, '<hr>');
  
  // 段落（处理连续的非标签行）
  const lines = html.split('\n');
  const result: string[] = [];
  let inParagraph = false;
  let paragraphContent: string[] = [];
  
  for (const line of lines) {
    const isBlockElement = /^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div)/.test(line.trim());
    const isEmpty = line.trim() === '';
    
    if (isBlockElement || isEmpty) {
      if (inParagraph && paragraphContent.length > 0) {
        result.push('<p>' + paragraphContent.join(' ') + '</p>');
        paragraphContent = [];
        inParagraph = false;
      }
      result.push(line);
    } else {
      inParagraph = true;
      paragraphContent.push(line);
    }
  }
  
  // 处理最后的段落
  if (paragraphContent.length > 0) {
    result.push('<p>' + paragraphContent.join(' ') + '</p>');
  }
  
  return result.join('\n');
}
