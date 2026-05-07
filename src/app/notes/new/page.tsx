"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bold,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  Code,
  Columns2,
  Eye,
  FileText,
  FlaskConical,
  GraduationCap,
  Heading2,
  Italic,
  List,
  ListChecks,
  Loader2,
  PanelRightOpen,
  Quote,
  Save,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TemplateId = "blank" | "course" | "paper" | "exam" | "mistake";
type ViewMode = "split" | "preview" | "source";

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

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" class="font-semibold text-cyan-700 underline underline-offset-4" target="_blank" rel="noreferrer">$1</a>')
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
      const level = Math.min(heading[1].length, 3);
      const className =
        level === 1
          ? "mt-1 mb-4 border-b border-slate-200 pb-3 text-3xl font-black"
          : level === 2
            ? "mt-7 mb-3 text-xl font-black"
            : "mt-5 mb-2 text-base font-bold";
      html.push(`<h${level} class="${className}">${renderInlineMarkdown(heading[2])}</h${level}>`);
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
      html.push(`<blockquote class="my-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-7 text-slate-700">${renderInlineMarkdown(trimmed.slice(2))}</blockquote>`);
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

    closeList();
    html.push(`<p class="my-3 text-sm leading-7 text-slate-700">${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  if (inCode) {
    html.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return html.join("\n");
}

function extractConcepts(value: string) {
  const concepts = new Set<string>();
  for (const match of value.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const concept = match[1]?.trim();
    if (concept) concepts.add(concept);
  }
  return [...concepts];
}

function PreviewDocument({ title, subject, content }: { title: string; subject: string; content: string }) {
  const previewHtml = renderMarkdownPreview(content);

  return (
    <div className="min-h-[620px] bg-[#fffdf8] px-6 py-6 md:px-9 md:py-8">
      <div className="mb-6 border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold text-slate-400">{subject || "未设置学科"}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title || "未命名学习笔记"}</h2>
      </div>
      {content.trim() ? (
        <div className="preview-body text-slate-800" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-center text-sm text-slate-500">
          在左侧输入内容，这里会像 Typora 一样实时渲染。
        </div>
      )}
    </div>
  );
}

const templates: NoteTemplate[] = [
  {
    id: "blank",
    title: "空白笔记",
    description: "自由记录，适合快速整理想法。",
    icon: FileText,
    titlePlaceholder: "输入笔记标题",
    content: "",
  },
  {
    id: "course",
    title: "课程笔记",
    description: "按目标、概念、例题和复习任务组织。",
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
    description: "整理问题、方法、证据和可复用观点。",
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

## 局限与启发
- 局限：
- 可以借鉴到我的项目：
`,
  },
  {
    id: "exam",
    title: "考试复习",
    description: "把考点、掌握度和复习计划放在一起。",
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

## 今日复习任务
- [ ] 
- [ ] 
`,
  },
  {
    id: "mistake",
    title: "错题整理",
    description: "记录错因、正确思路和防错策略。",
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
`,
  },
];

const toolbarItems = [
  { label: "二级标题", icon: Heading2, before: "\n## ", after: "" },
  { label: "粗体", icon: Bold, before: "**", after: "**" },
  { label: "斜体", icon: Italic, before: "*", after: "*" },
  { label: "列表", icon: List, before: "\n- ", after: "" },
  { label: "任务", icon: ListChecks, before: "\n- [ ] ", after: "" },
  { label: "引用", icon: Quote, before: "\n> ", after: "" },
  { label: "代码", icon: Code, before: "\n```\n", after: "\n```" },
];

export default function NewNotePage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("course");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(templates.find((item) => item.id === "course")?.content || "");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplate) || templates[0],
    [selectedTemplate]
  );
  const concepts = useMemo(() => extractConcepts(content), [content]);

  const applyTemplate = (template: NoteTemplate) => {
    setSelectedTemplate(template.id);
    if (!content.trim() || window.confirm("应用模板会替换当前正文，是否继续？")) {
      setContent(template.content);
    }
  };

  const insertMarkdown = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((value) => `${value}${before}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${before}${selected || ""}${after}${content.slice(end)}`;
    setContent(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = selected ? start + before.length + selected.length + after.length : start + before.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!response.ok) {
        setError(data.error || "保存失败，请稍后重试");
        return;
      }

      if (data.note) router.push(`/notes/${data.note.id}`);
    } catch (saveError) {
      console.error("Error creating note:", saveError);
      setError("保存失败，请检查网络或登录状态");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-950/10 bg-[#fbf7ee]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link href="/notes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight">写学习笔记</h1>
              <p className="mt-1 text-sm text-slate-600">边写边看，写完直接进入复述、测验和复习。</p>
            </div>
          </div>
          <Button form="note-form" type="submit" disabled={loading} className="bg-slate-950 text-white hover:bg-slate-800">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {loading ? "保存中" : "保存笔记"}
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 md:px-8 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-3 xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <div className="rounded-lg border border-slate-950/10 bg-white/75 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <h2 className="font-black">笔记模板</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">模板只负责起步，真正的重点是把概念写清楚、后面能验证。</p>
          </div>
          {templates.map((template) => {
            const Icon = template.icon;
            const active = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className={`w-full rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                    : "border-slate-950/10 bg-white/80 hover:bg-white"
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

        <form id="note-form" onSubmit={handleSubmit} className="min-w-0 space-y-4">
          <section className="rounded-lg border border-slate-950/10 bg-white/82 shadow-xl shadow-slate-950/5">
            <div className="grid gap-4 border-b border-slate-950/10 p-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div>
                <Label htmlFor="title">标题</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={currentTemplate.titlePlaceholder}
                  className="mt-2 h-11 border-slate-950/10 bg-white"
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
                  className="mt-2 h-11 border-slate-950/10 bg-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-950/10 bg-[#fffaf0] px-4 py-3">
              <div className="flex flex-wrap items-center gap-1">
                {toolbarItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.label}
                      type="button"
                      size="icon"
                      variant="ghost"
                      title={item.label}
                      className="h-8 w-8 rounded-md"
                      onClick={() => insertMarkdown(item.before, item.after)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden text-xs text-slate-500 md:block">
                  {content.length} 字符 · {concepts.length} 个概念
                </div>
                <div className="flex rounded-md border border-slate-950/10 bg-white p-1">
                  <Button type="button" size="sm" variant={viewMode === "split" ? "default" : "ghost"} onClick={() => setViewMode("split")}>
                    <Columns2 className="mr-1.5 h-4 w-4" />
                    双栏
                  </Button>
                  <Button type="button" size="sm" variant={viewMode === "preview" ? "default" : "ghost"} onClick={() => setViewMode("preview")}>
                    <Eye className="mr-1.5 h-4 w-4" />
                    预览
                  </Button>
                  <Button type="button" size="sm" variant={viewMode === "source" ? "default" : "ghost"} onClick={() => setViewMode("source")}>
                    <PanelRightOpen className="mr-1.5 h-4 w-4" />
                    源码
                  </Button>
                </div>
              </div>
            </div>

            <div className={viewMode === "split" ? "grid lg:grid-cols-2" : ""}>
              {viewMode !== "preview" && (
                <div className="min-w-0 border-slate-950/10 lg:border-r">
                  <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="输入笔记内容，使用 [[概念名]] 建立双链..."
                    rows={24}
                    className="min-h-[620px] resize-y rounded-none border-0 bg-white/92 p-6 font-mono text-sm leading-7 shadow-none focus-visible:ring-0"
                    required
                  />
                </div>
              )}

              {viewMode !== "source" && (
                <PreviewDocument title={title} subject={subject} content={content} />
              )}
            </div>
          </section>

          {concepts.length > 0 && (
            <section className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <CheckSquare className="h-4 w-4 text-cyan-700" />
                <span className="text-sm font-bold text-cyan-950">已识别概念</span>
                {concepts.map((concept) => (
                  <Badge key={concept} className="bg-white text-cyan-700 hover:bg-white">
                    [[{concept}]]
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
        </form>
      </main>
    </div>
  );
}
