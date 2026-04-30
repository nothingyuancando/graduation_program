"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Code,
  ClipboardCheck,
  Eye,
  FileText,
  FlaskConical,
  GraduationCap,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TemplateId = "blank" | "course" | "paper" | "exam" | "mistake";

type NoteTemplate = {
  id: TemplateId;
  title: string;
  description: string;
  icon: typeof FileText;
  titlePlaceholder: string;
  content: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractConcepts(value: string) {
  const concepts = new Set<string>();
  const matches = value.matchAll(/\[\[([^\]\n]+)\]\]/g);

  for (const match of matches) {
    const concept = match[1]?.trim();
    if (concept) concepts.add(concept);
  }

  return [...concepts];
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] text-slate-800">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, rawConcept: string) => {
      const concept = rawConcept.trim();
      if (!concept) return "";
      return `<a href="/concepts/${encodeURIComponent(concept)}" class="rounded-md bg-cyan-50 px-1.5 py-0.5 font-semibold text-cyan-700 no-underline hover:bg-cyan-100">[[${escapeHtml(concept)}]]</a>`;
    });
}

function renderMarkdownPreview(value: string) {
  const lines = value.split("\n");
  const html: string[] = [];
  let listMode: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLines: string[] = [];

  const closeList = () => {
    if (!listMode) return;
    html.push(listMode === "ol" ? "</ol>" : "</ul>");
    listMode = null;
  };

  const openList = (mode: "ul" | "ol") => {
    if (listMode === mode) return;
    closeList();
    html.push(mode === "ol" ? '<ol class="my-3 list-decimal space-y-1 pl-5">' : '<ul class="my-3 list-disc space-y-1 pl-5">');
    listMode = mode;
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        html.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const text = renderInlineMarkdown(heading[2]);
      const className =
        level === 1
          ? "mt-1 mb-4 border-b border-slate-200 pb-3 text-2xl font-black"
          : level === 2
            ? "mt-6 mb-3 text-lg font-black"
            : "mt-5 mb-2 text-base font-bold";
      html.push(`<h${Math.min(level, 3)} class="${className}">${text}</h${Math.min(level, 3)}>`);
      continue;
    }

    if (/^\|(.+)\|$/.test(trimmed)) {
      closeList();
      html.push(`<div class="my-2 overflow-x-auto rounded-lg border border-slate-200"><table class="w-full text-sm"><tbody><tr>${trimmed
        .split("|")
        .filter(Boolean)
        .map((cell) => `<td class="border-b border-slate-100 px-3 py-2">${renderInlineMarkdown(cell.trim())}</td>`)
        .join("")}</tr></tbody></table></div>`);
      continue;
    }

    const task = trimmed.match(/^-\s+\[( |x|X)\]\s+(.+)$/);
    if (task) {
      openList("ul");
      const checked = task[1].toLowerCase() === "x";
      html.push(`<li class="list-none -ml-5 flex items-start gap-2"><span class="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white"}">${checked ? "✓" : ""}</span><span>${renderInlineMarkdown(task[2])}</span></li>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      openList("ul");
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      openList("ol");
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    if (trimmed.startsWith("> ")) {
      closeList();
      html.push(`<blockquote class="my-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-2 text-sm text-slate-700">${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    closeList();
    html.push(`<p class="my-3 text-sm leading-7 text-slate-700">${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  if (inCode) {
    html.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("\n");
}

function PreviewPane({ title, subject, content }: { title: string; subject: string; content: string }) {
  const concepts = extractConcepts(content);
  const previewHtml = renderMarkdownPreview(content);

  return (
    <aside className="sticky top-28 h-[calc(100vh-8rem)] space-y-4 overflow-y-auto">
      <section className="rounded-2xl border border-slate-950/10 bg-white/85 shadow-xl shadow-slate-950/5">
        <div className="flex items-center justify-between border-b border-slate-950/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-cyan-700" />
            <h2 className="font-black">实时预览</h2>
          </div>
          <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">Obsidian 风格</Badge>
        </div>
        <div className="px-5 py-5">
          <div className="mb-5 rounded-xl border border-slate-950/10 bg-[#fbf7ee] p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">当前笔记</p>
            <h3 className="mt-2 line-clamp-2 text-xl font-black">{title || "未命名学习笔记"}</h3>
            <p className="mt-1 text-sm text-slate-500">{subject || "未设置学科"}</p>
          </div>

          {content.trim() ? (
            <div
              className="preview-body text-slate-800"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              开始输入 Markdown 后，这里会实时显示渲染效果。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-950/10 bg-white/80 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h2 className="font-black">概念连接</h2>
        </div>
        {concepts.length ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              {concepts.map((concept) => (
                <Link key={concept} href={`/concepts/${encodeURIComponent(concept)}`}>
                  <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100">[[{concept}]]</Badge>
                </Link>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-slate-950 p-4 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <CheckSquare className="h-4 w-4" />
                保存后会进入双链索引
              </div>
              <p className="mt-2 text-xs leading-5 text-white/55">
                这些概念会在概念页形成反向链接，方便从一个知识点跳回相关笔记。
              </p>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            在正文中输入 <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">[[概念名]]</span>，这里会实时出现概念节点。
          </p>
        )}
      </section>
    </aside>
  );
}

const templates: NoteTemplate[] = [
  {
    id: "blank",
    title: "空白笔记",
    description: "自由记录，适合临时想法和快速整理。",
    icon: FileText,
    titlePlaceholder: "输入笔记标题",
    content: "",
  },
  {
    id: "course",
    title: "课程笔记",
    description: "按知识点、例题和课后问题组织课堂内容。",
    icon: BookOpen,
    titlePlaceholder: "课程名 / 章节名",
    content: `# 课程主题

## 本节目标
- 

## 关键概念
- [[概念一]]：
- [[概念二]]：

## 课堂要点
1. 
2. 
3. 

## 例题 / 案例
- 题目：
- 解法：
- 易错点：

## 课后待复习
- [ ] 
`,
  },
  {
    id: "paper",
    title: "论文阅读",
    description: "整理研究问题、方法、实验结论和可复用观点。",
    icon: FlaskConical,
    titlePlaceholder: "论文标题",
    content: `# 论文阅读

## 基本信息
- 论文：
- 作者：
- 年份：
- 领域：

## 研究问题

## 核心方法
- [[方法名]]：

## 关键贡献
1. 
2. 

## 实验与证据
- 数据集：
- 指标：
- 主要结果：

## 局限与启发
- 局限：
- 可以借鉴到我的项目：
`,
  },
  {
    id: "exam",
    title: "考试复习",
    description: "面向考试，把考点、掌握度和复习计划放在一起。",
    icon: GraduationCap,
    titlePlaceholder: "科目 / 考试范围",
    content: `# 考试复习

## 考试范围
- 

## 高频考点
- [[考点一]]：
- [[考点二]]：

## 掌握度自评
| 考点 | 掌握度 | 待补充 |
| --- | --- | --- |
|  | 低/中/高 |  |

## 典型题型
1. 

## 今日复习任务
- [ ] 
- [ ] 
`,
  },
  {
    id: "mistake",
    title: "错题整理",
    description: "记录错误原因、正确思路和相似题触发条件。",
    icon: ClipboardCheck,
    titlePlaceholder: "错题主题 / 题型",
    content: `# 错题整理

## 原题

## 我的错误答案

## 正确答案 / 正确思路

## 错因分析
- 概念漏洞：[[相关概念]]
- 计算/推理问题：
- 审题问题：

## 避免再错
- 看到什么特征要警惕：
- 下次解题步骤：

## 相似题
- 
`,
  },
];

export default function NewNotePage() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("course");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(templates.find((item) => item.id === "course")?.content || "");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const currentTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplate) || templates[0],
    [selectedTemplate]
  );

  const applyTemplate = (template: NoteTemplate) => {
    setSelectedTemplate(template.id);
    if (!content.trim() || confirm("应用模板会替换当前正文，是否继续？")) {
      setContent(template.content);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          subject: subject.trim() || undefined,
          contentType: "markdown",
          sourceType: "text",
          status: "draft",
        }),
      });

      const data = await response.json();
      if (data.note) {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (error) {
      console.error("Error creating note:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4efe4] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-950/10 bg-[#f8f1e6]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 md:px-8">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link href="/notes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">新建学习笔记</h1>
              <Badge className="bg-white/70 text-slate-700 hover:bg-white/70">模板化输入</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">用 Notion 式模板固定结构，再用 [[概念]] 建立双链。</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-6 px-5 py-8 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_380px] md:px-8">
        <aside className="space-y-3 lg:sticky lg:top-28 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
          {templates.map((template) => {
            const Icon = template.icon;
            const active = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                    : "border-slate-950/10 bg-white/75 hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${active ? "text-[#f7c76b]" : "text-slate-500"}`} />
                  <span className="font-bold">{template.title}</span>
                </div>
                <p className={`mt-2 text-sm leading-6 ${active ? "text-white/65" : "text-slate-500"}`}>
                  {template.description}
                </p>
              </button>
            );
          })}
        </aside>

        <Card className="border-slate-950/10 bg-white/78 shadow-xl shadow-slate-950/5">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>创建笔记</CardTitle>
                <CardDescription className="mt-2">
                  当前模板：{currentTemplate.title}。正文支持 Markdown，也支持 Obsidian 风格的 [[概念]] 双链。
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-white">
                <Code className="mr-1.5 h-3.5 w-3.5" />
                Markdown
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <Label htmlFor="title">标题</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={currentTemplate.titlePlaceholder}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="subject">学科</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="如：机器学习"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="content">内容</Label>
                  <span className="text-xs text-slate-500">{content.length} 字符</span>
                </div>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="输入笔记内容，使用 [[概念名]] 建立双链..."
                  rows={24}
                  className="min-h-[680px] resize-y rounded-2xl border-slate-950/10 bg-white/90 font-mono text-sm leading-6 shadow-inner"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={loading} className="bg-slate-950 text-white hover:bg-slate-800">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      保存笔记
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/notes">取消</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-start-2 xl:col-start-3 xl:row-start-1">
          <PreviewPane title={title} subject={subject} content={content} />
        </div>
      </main>
    </div>
  );
}
