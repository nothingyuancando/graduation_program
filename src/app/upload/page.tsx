"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bold,
  BookOpen,
  CheckCircle,
  Clock3,
  Code,
  Columns2,
  FileCheck2,
  FileText,
  FlaskConical,
  Globe,
  GraduationCap,
  Heading2,
  Italic,
  Layers,
  List,
  ListChecks,
  Loader2,
  NotebookPen,
  PanelRightOpen,
  Quote,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const flowSteps = [
  ["结构化", "提取主题、摘要、关键概念和可追踪知识点。"],
  ["可验证", "笔记生成后可以进入费曼复述、测验和弱点分析。"],
  ["可复习", "后续可转成闪卡，把内容送入主动回忆流程。"],
];

const importModes = [
  {
    value: "write",
    title: "自己写笔记",
    description: "直接写 Markdown，保存后进入复述、测验和复习。",
    icon: NotebookPen,
  },
  {
    value: "text",
    title: "粘贴文本",
    description: "适合快速整理课程片段、文章摘录和错题解析。",
    icon: FileText,
  },
  {
    value: "file",
    title: "单个文件",
    description: "适合少量 PDF 或图片材料。",
    icon: Upload,
  },
  {
    value: "url",
    title: "网页链接",
    description: "适合导入一篇公开文章或教程。",
    icon: Globe,
  },
];

type WriteTemplateId = "blank" | "course" | "paper" | "exam" | "mistake";
type WriteViewMode = "split" | "preview" | "source";

const writeTemplates = [
  {
    id: "blank" as const,
    title: "空白笔记",
    description: "自由记录，适合快速整理想法。",
    icon: FileText,
    titlePlaceholder: "输入笔记标题",
    content: "",
  },
  {
    id: "course" as const,
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
    id: "paper" as const,
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
    id: "exam" as const,
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
|  | 低 / 中 / 高 |  |

## 今日复习任务
- [ ] 
- [ ] 
`,
  },
  {
    id: "mistake" as const,
    title: "错题整理",
    description: "记录错因、正确思路和防错策略。",
    icon: CheckCircle,
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

const writeToolbarItems = [
  { label: "二级标题", icon: Heading2, before: "\n## ", after: "" },
  { label: "粗体", icon: Bold, before: "**", after: "**" },
  { label: "斜体", icon: Italic, before: "*", after: "*" },
  { label: "列表", icon: List, before: "\n- ", after: "" },
  { label: "任务", icon: ListChecks, before: "\n- [ ] ", after: "" },
  { label: "引用", icon: Quote, before: "\n> ", after: "" },
  { label: "代码", icon: Code, before: "\n```\n", after: "\n```" },
];

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
      return `<span class="rounded-md bg-cyan-50 px-1.5 py-0.5 font-semibold text-cyan-700">[[${escapeHtml(concept)}]]</span>`;
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

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function UploadPage() {
  const router = useRouter();
  const writeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeTab, setActiveTab] = useState("write");
  const [error, setError] = useState("");

  const [writeTemplate, setWriteTemplate] = useState<WriteTemplateId>("course");
  const [writeViewMode, setWriteViewMode] = useState<WriteViewMode>("split");
  const [writeTitle, setWriteTitle] = useState("");
  const [writeSubject, setWriteSubject] = useState("");
  const [writeContent, setWriteContent] = useState(writeTemplates.find((item) => item.id === "course")?.content || "");
  const [writeLoading, setWriteLoading] = useState(false);

  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileLoading, setFileLoading] = useState(false);

  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  const textStats = useMemo(() => {
    const trimmed = textContent.trim();
    return {
      chars: trimmed.length,
      ready: textTitle.trim().length > 0 && trimmed.length >= 20,
    };
  }, [textContent, textTitle]);

  const writeStats = useMemo(() => {
    const trimmed = writeContent.trim();
    return {
      chars: trimmed.length,
      ready: writeTitle.trim().length > 0 && trimmed.length > 0,
    };
  }, [writeContent, writeTitle]);
  const currentWriteTemplate = useMemo(
    () => writeTemplates.find((item) => item.id === writeTemplate) || writeTemplates[0],
    [writeTemplate]
  );
  const writeConcepts = useMemo(() => extractConcepts(writeContent), [writeContent]);
  const writePreviewHtml = useMemo(() => renderMarkdownPreview(writeContent), [writeContent]);

  const selectedMode = importModes.find((mode) => mode.value === activeTab) || importModes[0];
  const SelectedModeIcon = selectedMode.icon;
  const isBusy = writeLoading || textLoading || fileLoading || urlLoading;

  const applyWriteTemplate = (template: (typeof writeTemplates)[number]) => {
    setWriteTemplate(template.id);
    if (!writeContent.trim() || window.confirm("应用模板会替换当前正文，是否继续？")) {
      setWriteContent(template.content);
    }
  };

  const insertWriteMarkdown = (before: string, after: string) => {
    const textarea = writeTextareaRef.current;
    if (!textarea) {
      setWriteContent((value) => `${value}${before}${after}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = writeContent.slice(start, end);
    const next = `${writeContent.slice(0, start)}${before}${selected}${after}${writeContent.slice(end)}`;
    setWriteContent(next);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = selected ? start + before.length + selected.length + after.length : start + before.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleWriteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!writeStats.ready) {
      setError("请填写标题和笔记内容。");
      return;
    }

    setWriteLoading(true);
    setError("");

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: writeTitle.trim(),
          content: writeContent.trim(),
          subject: writeSubject.trim() || undefined,
          contentType: "markdown",
          sourceType: "text",
          status: "draft",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存笔记失败");
      if (data.note) router.push(`/notes/${data.note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存笔记失败");
    } finally {
      setWriteLoading(false);
    }
  };

  const handleTextSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!textStats.ready) {
      setError("请填写标题，并粘贴至少 20 个字的学习材料。");
      return;
    }

    setTextLoading(true);
    setError("");

    try {
      const response = await fetch("/api/upload/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: textTitle.trim(),
          content: textContent.trim(),
          contentType: "text",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建学习笔记失败");
      if (data.note) router.push(`/notes/${data.note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建学习笔记失败");
    } finally {
      setTextLoading(false);
    }
  };

  const handleFileUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError("请先选择一个 PDF 或图片文件。");
      return;
    }

    setFileLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (fileTitle.trim()) formData.append("title", fileTitle.trim());

      const endpoint = file.type === "application/pdf" ? "/api/upload/pdf" : "/api/upload/image";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传文件失败");
      if (data.note) router.push(`/notes/${data.note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传文件失败");
    } finally {
      setFileLoading(false);
    }
  };

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) {
      setError("请先输入网页链接。");
      return;
    }

    setUrlLoading(true);
    setError("");

    try {
      const response = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: urlTitle.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "导入网页失败");
      if (data.note) router.push(`/notes/${data.note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入网页失败");
    } finally {
      setUrlLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.006_235)] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[oklch(0.995_0.004_235)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/" aria-label="返回工作台">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight">做学习笔记</h1>
              <p className="truncate text-sm text-slate-500">
                自己写、粘贴材料、上传文件或导入网页，最后都进入学习闭环。
              </p>
            </div>
          </div>
          <Button variant="outline" className="hidden shrink-0 border-slate-200 bg-white sm:inline-flex" asChild>
            <Link href="/upload/batch">
              <Layers className="mr-2 h-4 w-4" />
              高级导入
            </Link>
          </Button>
        </div>
      </header>

      <main
        className={`mx-auto grid gap-6 px-5 py-6 md:px-8 ${
          activeTab === "write"
            ? "max-w-[1500px]"
            : "max-w-6xl lg:grid-cols-[minmax(0,1fr)_330px]"
        }`}
      >
        <section className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="mb-3 bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                  笔记创建
                </Badge>
                <h2 className="text-2xl font-black tracking-tight md:text-3xl">
                  {activeTab === "write" ? "专注写作，保存后进入学习闭环。" : "先得到一篇可靠笔记，再进入理解验证。"}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  {activeTab === "write"
                    ? "模板、编辑和实时预览集中在同一个工作区；导入说明会在粘贴、文件和网页模式下显示。"
                    : "你可以从空白笔记开始，也可以让 AI 把材料整理成学习笔记。大量文件放到高级导入，系统会展示真实处理进度。"}
                </p>
              </div>
              <Button variant="outline" className="border-slate-200 bg-white sm:hidden" asChild>
                <Link href="/upload/batch">
                  <Layers className="mr-2 h-4 w-4" />
                  高级导入
                </Link>
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {importModes.map((mode) => {
                const Icon = mode.icon;
                const selected = activeTab === mode.value;
                return (
                  <button
                    key={mode.value}
                    type="button"
                    onClick={() => setActiveTab(mode.value)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selected
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <Icon className={selected ? "mb-3 h-5 w-5 text-amber-300" : "mb-3 h-5 w-5 text-slate-500"} />
                    <p className="font-black">{mode.title}</p>
                    <p className={selected ? "mt-1 text-sm leading-5 text-white/70" : "mt-1 text-sm leading-5 text-slate-500"}>
                      {mode.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="sr-only">
              <TabsTrigger value="write">自己写笔记</TabsTrigger>
              <TabsTrigger value="text">粘贴文本</TabsTrigger>
              <TabsTrigger value="file">单个文件</TabsTrigger>
              <TabsTrigger value="url">网页链接</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="mt-0">
              <form onSubmit={handleWriteSubmit} className="grid gap-5 xl:grid-cols-[210px_minmax(0,1fr)]">
                <aside className="space-y-3">
                  <Card className="border-slate-200 bg-white shadow-sm">
                    <CardHeader className="p-4">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-4 w-4 text-amber-600" />
                        笔记模板
                      </CardTitle>
                      <CardDescription>选一个结构再开始写。</CardDescription>
                    </CardHeader>
                  </Card>
                  {writeTemplates.map((template) => {
                    const Icon = template.icon;
                    const active = writeTemplate === template.id;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyWriteTemplate(template)}
                        className={`w-full rounded-lg border p-4 text-left transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={active ? "h-5 w-5 text-amber-300" : "h-5 w-5 text-slate-500"} />
                          <span className="font-bold">{template.title}</span>
                        </div>
                        <p className={active ? "mt-2 text-sm leading-5 text-white/70" : "mt-2 text-sm leading-5 text-slate-500"}>
                          {template.description}
                        </p>
                      </button>
                    );
                  })}
                </aside>

                <Card className="min-w-0 overflow-hidden border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <NotebookPen className="h-5 w-5 text-slate-800" />
                          自己写学习笔记
                        </CardTitle>
                        <CardDescription>
                          模板、Markdown 工具栏、双栏预览都在这里。保存后自动补摘要、关键点和思维导图。
                        </CardDescription>
                      </div>
                      <Button
                        type="submit"
                        disabled={writeLoading || !writeStats.ready}
                        className="h-10 bg-slate-950 px-5 text-white hover:bg-slate-800"
                      >
                        {writeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <NotebookPen className="mr-2 h-4 w-4" />}
                        保存笔记
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid gap-4 border-y border-slate-200 bg-slate-50/70 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                      <div className="space-y-2">
                        <Label htmlFor="write-title">标题</Label>
                        <Input
                          id="write-title"
                          value={writeTitle}
                          onChange={(event) => setWriteTitle(event.target.value)}
                          placeholder={currentWriteTemplate.titlePlaceholder}
                          disabled={writeLoading}
                          required
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="write-subject">学科，可选</Label>
                        <Input
                          id="write-subject"
                          value={writeSubject}
                          onChange={(event) => setWriteSubject(event.target.value)}
                          placeholder="例如：计算机基础"
                          disabled={writeLoading}
                          className="bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {writeToolbarItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Button
                              key={item.label}
                              type="button"
                              size="icon"
                              variant="ghost"
                              title={item.label}
                              className="h-8 w-8 rounded-md"
                              onClick={() => insertWriteMarkdown(item.before, item.after)}
                            >
                              <Icon className="h-4 w-4" />
                            </Button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {writeStats.chars} 字 · {writeConcepts.length} 个概念
                        </span>
                        <div className="flex rounded-md border border-slate-200 bg-white p-1">
                          <Button type="button" size="sm" variant={writeViewMode === "split" ? "default" : "ghost"} onClick={() => setWriteViewMode("split")}>
                            <Columns2 className="mr-1.5 h-4 w-4" />
                            双栏
                          </Button>
                          <Button type="button" size="sm" variant={writeViewMode === "preview" ? "default" : "ghost"} onClick={() => setWriteViewMode("preview")}>
                            <FileText className="mr-1.5 h-4 w-4" />
                            预览
                          </Button>
                          <Button type="button" size="sm" variant={writeViewMode === "source" ? "default" : "ghost"} onClick={() => setWriteViewMode("source")}>
                            <PanelRightOpen className="mr-1.5 h-4 w-4" />
                            源码
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className={writeViewMode === "split" ? "grid 2xl:grid-cols-2" : ""}>
                      {writeViewMode !== "preview" && (
                        <div className="min-w-0 border-slate-200 2xl:border-r">
                          <Textarea
                            ref={writeTextareaRef}
                            id="write-content"
                            value={writeContent}
                            onChange={(event) => setWriteContent(event.target.value)}
                            placeholder="输入笔记内容，支持 Markdown 和 [[概念双链]]..."
                            rows={24}
                            disabled={writeLoading}
                            required
                            className="min-h-[620px] resize-y rounded-none border-0 bg-white p-6 font-mono text-sm leading-7 shadow-none focus-visible:ring-0"
                          />
                        </div>
                      )}
                      {writeViewMode !== "source" && (
                        <div className="min-h-[620px] bg-[#fffdf8] px-6 py-6 md:px-9 md:py-8">
                          <div className="mb-6 border-b border-slate-200 pb-5">
                            <p className="text-xs font-semibold text-slate-400">{writeSubject || "未设置学科"}</p>
                            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                              {writeTitle || "未命名学习笔记"}
                            </h2>
                          </div>
                          {writeContent.trim() ? (
                            <div className="text-slate-800" dangerouslySetInnerHTML={{ __html: writePreviewHtml }} />
                          ) : (
                            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-300 text-center text-sm text-slate-500">
                              在左侧输入内容，这里会像 Typora 一样实时预览。
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
                      手写模式会保留你的原文，不会把正文改写成 AI 版本；系统只补充摘要、关键点和思维导图，用来衔接后续复述与测验。
                    </div>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>

            <TabsContent value="text" className="mt-0">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-700" />
                    粘贴学习材料
                  </CardTitle>
                  <CardDescription>
                    适合把已有材料快速整理成可复习、可测验的学习笔记。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTextSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="text-title">标题</Label>
                      <Input
                        id="text-title"
                        value={textTitle}
                        onChange={(event) => setTextTitle(event.target.value)}
                        placeholder="例如：数据库事务 ACID"
                        disabled={textLoading}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="text-content">内容</Label>
                        <span className="text-xs text-slate-500">{textStats.chars} 字</span>
                      </div>
                      <Textarea
                        id="text-content"
                        value={textContent}
                        onChange={(event) => setTextContent(event.target.value)}
                        placeholder="粘贴课程内容、教材片段、课堂笔记或错题解析。尽量保留小标题和关键段落，AI 会更容易提取知识点。"
                        rows={16}
                        disabled={textLoading}
                        required
                      />
                      <p className="text-xs leading-5 text-slate-500">
                        建议一次处理 500 到 3000 字。内容太长时，优先拆成多个主题明确的笔记。
                      </p>
                    </div>
                    <Button
                      type="submit"
                      disabled={textLoading || !textStats.ready}
                      className="h-11 bg-slate-950 px-5 text-white hover:bg-slate-800"
                    >
                      {textLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                      生成学习笔记
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="file" className="mt-0">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-emerald-700" />
                    上传单个文件
                  </CardTitle>
                  <CardDescription>
                    适合单份 PDF 或图片。多文件资料包请使用高级导入查看队列进度。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="file-upload">文件</Label>
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={(event) => setFile(event.target.files?.[0] || null)}
                        disabled={fileLoading}
                        required
                      />
                      {file ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-bold text-slate-800">{file.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {file.type || "未知类型"}，{formatFileSize(file.size)}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">当前普通导入支持 PDF 和图片。</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file-title">标题，可选</Label>
                      <Input
                        id="file-title"
                        value={fileTitle}
                        onChange={(event) => setFileTitle(event.target.value)}
                        placeholder="留空则使用文件名"
                        disabled={fileLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={fileLoading || !file}
                      className="h-11 bg-slate-950 px-5 text-white hover:bg-slate-800"
                    >
                      {fileLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      上传并生成笔记
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="url" className="mt-0">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-700" />
                    导入网页内容
                  </CardTitle>
                  <CardDescription>
                    输入文章 URL，系统会尝试抓取正文并生成一篇学习笔记。
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="url-input">URL</Label>
                      <Input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com/article"
                        disabled={urlLoading}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url-title">标题，可选</Label>
                      <Input
                        id="url-title"
                        value={urlTitle}
                        onChange={(event) => setUrlTitle(event.target.value)}
                        placeholder="留空则使用网页标题"
                        disabled={urlLoading}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={urlLoading || !url.trim()}
                      className="h-11 bg-slate-950 px-5 text-white hover:bg-slate-800"
                    >
                      {urlLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                      抓取并生成笔记
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </section>

        {activeTab !== "write" && (
        <aside className="space-y-5">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SelectedModeIcon className="h-5 w-5 text-slate-700" />
                当前方式：{selectedMode.title}
              </CardTitle>
              <CardDescription>{selectedMode.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {flowSteps.map(([title, description], index) => (
                <div key={title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-slate-200 bg-[oklch(0.2_0.018_245)] p-5 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-bold">处理状态说明</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/72">
              “上传完成”只代表材料进入处理流程。真正可学习的笔记，会在解析和 AI 生成完成后出现。
            </p>
            <Button className="mt-4 bg-white text-slate-950 hover:bg-slate-100" asChild>
              <Link href="/upload/batch">
                查看高级导入
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-amber-600" />
                导入后的下一步
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/feynman"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-bold transition hover:bg-slate-50"
              >
                进入费曼复述
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link
                href="/quiz"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-bold transition hover:bg-slate-50"
              >
                生成测验
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
              <Link
                href="/review"
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm font-bold transition hover:bg-slate-50"
              >
                今日主动回忆
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            </CardContent>
          </Card>

          {isBusy && (
            <div className="flex items-start gap-3 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-900">
              <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>正在生成笔记，请保持页面打开。完成后会自动进入笔记详情。</p>
            </div>
          )}
        </aside>
        )}
      </main>
    </div>
  );
}
