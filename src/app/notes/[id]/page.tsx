"use client";

import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Save,
  Brain,
  FileText,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Columns2,
  FileDown,
  ExternalLink,
  Eye,
  Code,
  PanelRightOpen,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  GraduationCap,
  Trash2,
  Share2,
  Copy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MindMapViewer,
  FlashcardViewer,
  TimelineViewer,
  ComparisonViewer
} from "@/components/note-enhancements";
import RelatedNotes from "@/components/RelatedNotes";

interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  source_type: string;
  status: string;
  themes?: Array<{ name: string; importance: number; description?: string }>;
  key_points?: Array<{ point: string; sourceQuote: string; confidence: number }> | string[];
  tasks?: Array<{ content: string; assignee?: string; deadline?: string; status?: string }>;
  entities?: {
    concepts?: Array<{ name: string; definition?: string; importance?: string; source?: string }>;
    formulas?: Array<{ name: string; expression?: string; meaning?: string; usage?: string }>;
    methods?: Array<{ name: string; steps?: string[]; scenario?: string; notes?: string }>;
    pitfalls?: Array<{ name: string; description?: string; correction?: string }>;
    applications?: Array<{ name: string; scenario?: string; value?: string }>;
    persons?: Array<{ name: string; position?: string; relation?: string }>;
    organizations?: Array<{ name: string; type?: string; description?: string }>;
    locations?: Array<{ name: string; type?: string; context?: string }>;
    dates?: Array<{ date: string; event?: string; importance?: string }>;
    numbers?: Array<{ value: string; unit?: string; context?: string; significance?: string }>;
  };
  // 新增：辅助学习资料
  mind_map?: {
    id: string;
    label: string;
    description?: string;
    type?: string;
    children?: Array<{
      id: string;
      label: string;
      description?: string;
      type?: string;
      children?: Array<{
        id: string;
        label: string;
        description?: string;
        type?: string;
        children?: Array<{ id: string; label: string; description?: string; type?: string }>;
      }>;
    }>;
  } | null;
  flashcards?: Array<{
    id: string;
    question: string;
    answer: string;
    category: string;
    difficulty: number;
  }>;
  timeline?: Array<{
    date: string;
    event: string;
    importance?: "high" | "medium" | "low";
  }>;
  comparisons?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  fork_count?: number;
}

interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  type?: string;
  children?: MindMapNode[];
}

function keyPointText(item: NonNullable<Note["key_points"]>[number]) {
  return typeof item === "object" && item !== null && "point" in item ? item.point : String(item);
}

function cleanHeading(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\[\[|\]\]/g, "")
    .trim();
}

function excerpt(value: string, maxLength = 80) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function buildMindMapFromNote(note: Note): MindMapNode {
  const lines = note.content.split(/\r?\n/);
  const headings = lines
    .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .slice(0, 8);

  const headingNodes = headings.map((match, index) => {
    const heading = cleanHeading(match[2]);
    const startLine = lines.findIndex((line) => line.trim() === match[0].trim());
    const nextHeading = lines.findIndex((line, lineIndex) => lineIndex > startLine && /^#{2,4}\s+/.test(line));
    const sectionLines = lines
      .slice(startLine + 1, nextHeading === -1 ? startLine + 8 : nextHeading)
      .filter((line) => line.trim() && !/^[-*]\s*$/.test(line));

    return {
      id: `section-${index}`,
      label: heading,
      description: excerpt(sectionLines.join(" "), 96),
      type: "section",
    };
  });

  const keyPointNodes = (note.key_points || [])
    .map(keyPointText)
    .filter(Boolean)
    .slice(0, 6)
    .map((point, index) => ({
      id: `key-point-${index}`,
      label: excerpt(point, 30),
      description: excerpt(point, 90),
      type: "key_point",
    }));

  const children: MindMapNode[] = [];
  if (note.summary) {
    children.push({
      id: "summary",
      label: "学习摘要",
      description: excerpt(note.summary, 120),
      type: "summary",
    });
  }
  if (headingNodes.length > 0) {
    children.push({
      id: "sections",
      label: "笔记结构",
      description: "根据 Markdown 小节自动整理",
      type: "group",
      children: headingNodes,
    });
  }
  if (keyPointNodes.length > 0) {
    children.push({
      id: "key-points",
      label: "核心要点",
      description: "来自 AI 提炼的关键知识点",
      type: "group",
      children: keyPointNodes,
    });
  }

  if (children.length === 0) {
    children.push({
      id: "content",
      label: "笔记内容",
      description: excerpt(note.content, 120),
      type: "content",
    });
  }

  return {
    id: note.id,
    label: note.title || "学习笔记",
    description: note.tags?.slice(0, 4).join(" / "),
    type: "note",
    children,
  };
}

// 简单的 Markdown 渲染组件
function MarkdownRenderer({ content }: { content: string }) {
  const renderMarkdown = (text: string): string => {
    let html = text;
    
    // 转义 HTML
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // 代码块（需要先处理，避免内部内容被其他规则影响）
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm my-4"><code>$2</code></pre>');
    
    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-sm">$1</code>');

    html = html.replace(/\[\[([^\]\n]+)\]\]/g, (_, rawConcept: string) => {
      const concept = rawConcept.trim();
      if (!concept) return "";
      return `<a href="/concepts/${encodeURIComponent(concept)}" class="rounded-md bg-cyan-50 px-1.5 py-0.5 font-medium text-cyan-700 no-underline hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-300">[[${concept}]]</a>`;
    });
    
    // 表格处理（需要在段落处理之前）
    html = html.replace(/^\|(.+)\|\s*\n\|[-:\| ]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm, (match, headerRow, bodyRows) => {
      const headers = headerRow.split('|').map((h: string) => h.trim()).filter((h: string) => h);
      const rows = bodyRows.trim().split('\n').map((row: string) => 
        row.split('|').map((cell: string) => cell.trim()).filter((cell: string) => cell !== '')
      );
      
      let tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-slate-300 dark:border-slate-600">\n';
      tableHtml += '<thead class="bg-slate-100 dark:bg-slate-800">\n<tr>\n';
      headers.forEach((h: string) => {
        tableHtml += `<th class="border border-slate-300 dark:border-slate-600 px-4 py-2 text-left font-semibold">${h}</th>\n`;
      });
      tableHtml += '</tr>\n</thead>\n<tbody>\n';
      rows.forEach((row: string[]) => {
        tableHtml += '<tr class="even:bg-slate-50 dark:even:bg-slate-900/50">\n';
        row.forEach((cell: string) => {
          tableHtml += `<td class="border border-slate-300 dark:border-slate-600 px-4 py-2">${cell}</td>\n`;
        });
        tableHtml += '</tr>\n';
      });
      tableHtml += '</tbody>\n</table></div>\n';
      return tableHtml;
    });
    
    // 标题（从高到低处理，避免匹配冲突）
    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-sm font-medium text-slate-600 dark:text-slate-400 mt-4 mb-2">$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-base font-medium text-slate-700 dark:text-slate-300 mt-4 mb-2">$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-medium text-slate-800 dark:text-slate-200 mt-5 mb-2">$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold border-l-4 border-blue-500 pl-3 mt-8 mb-4">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold border-b pb-3 mb-6">$1</h1>');
    
    // 粗体和斜体
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    
    // 引用
    html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/30 pl-4 py-2 italic my-4">$1</blockquote>');
    
    // 水平线
    html = html.replace(/^---$/gm, '<hr class="my-6 border-t border-slate-300 dark:border-slate-600">');
    
    // 无序列表
    html = html.replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc list-inside space-y-1 my-2">$&</ul>');
    
    // 有序列表
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4">$1</li>');
    
    // 段落
    const lines = html.split("\n");
    const result: string[] = [];
    let inParagraph = false;
    let paragraphContent: string[] = [];
    
    for (const line of lines) {
      const isBlockElement = /^<(h[1-6]|ul|ol|li|blockquote|pre|hr|div|p|table|thead|tbody|tr|th|td)/.test(line.trim());
      const isEmpty = line.trim() === "";
      
      if (isBlockElement || isEmpty) {
        if (inParagraph && paragraphContent.length > 0) {
          result.push("<p>" + paragraphContent.join(" ") + "</p>");
          paragraphContent = [];
          inParagraph = false;
        }
        result.push(line);
      } else {
        inParagraph = true;
        paragraphContent.push(line);
      }
    }
    
    if (paragraphContent.length > 0) {
      result.push("<p>" + paragraphContent.join(" ") + "</p>");
    }
    
    return result.join("\n");
  };

  return (
    <div
      className="prose prose-slate dark:prose-invert max-w-none prose-headings:text-slate-900 dark:prose-headings:text-slate-100 prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-code:text-slate-800 dark:prose-code:text-slate-200"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "preview" | "source">("preview");

  // 反馈相关状态
  const [feedbackLoading, setFeedbackLoading] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPointIndex, setEditingPointIndex] = useState<number | null>(null);
  const [editingPointText, setEditingPointText] = useState("");

  useEffect(() => {
    fetchNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const fetchNote = async () => {
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      const data = await response.json();
      if (data.note) {
        setNote(data.note);
        setEditedTitle(data.note.title);
        setEditedContent(data.note.content);
      }
    } catch (error) {
      console.error("Error fetching note:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editedTitle,
          content: editedContent,
        }),
      });

      const data = await response.json();
      if (data.note) {
        setNote(data.note);
        setEditing(false);
      }
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/notes/${noteId}/analyze`, {
        method: "POST",
      });

      const data = await response.json();
      if (data.analysis) {
        await fetchNote();
      }
    } catch (error) {
      console.error("Error analyzing note:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!note || !window.confirm(`确定把「${note.title}」移入回收站吗？`)) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data.error || "删除笔记失败");
        return;
      }
      router.push("/notes");
      router.refresh();
    } catch (error) {
      console.error("Error deleting note:", error);
      window.alert("删除笔记失败，请稍后重试");
    } finally {
      setDeleting(false);
    }
  };

  const getShareUrl = () => `${window.location.origin}/share/${noteId}`;

  const handleTogglePublic = async () => {
    if (!note) return;
    setSharing(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !note.is_public }),
      });
      const data = await response.json();
      if (!response.ok) {
        window.alert(data.error || "更新分享状态失败");
        return;
      }

      setNote(data.note);
      if (data.note?.is_public) {
        await navigator.clipboard?.writeText(getShareUrl()).catch(() => undefined);
      }
    } catch (error) {
      console.error("Error toggling public note:", error);
      window.alert("更新分享状态失败，请稍后重试");
    } finally {
      setSharing(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!note?.is_public) return;
    await navigator.clipboard?.writeText(getShareUrl()).catch(() => undefined);
    window.alert("分享链接已复制");
  };

  const handleDownloadMarkdown = async () => {
    try {
      const response = await fetch(`/api/notes/${noteId}/export/markdown`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${note?.title || "note"}.md`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading markdown:", error);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/notes/${noteId}/export/pdf`, "_blank");
  };

  const handleDownloadHTML = async () => {
    try {
      const response = await fetch(`/api/notes/${noteId}/export/html`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${note?.title || "note"}.html`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading HTML:", error);
    }
  };

  // 知识点反馈处理
  const handleFeedback = async (
    index: number,
    action: "correct" | "incorrect" | "edited",
    original: string,
    corrected?: string
  ) => {
    setFeedbackLoading(index);
    try {
      await fetch(`/api/notes/${noteId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointIndex: index, action, original, corrected }),
      });
      await fetchNote();
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const openEditDialog = (index: number, currentText: string) => {
    setEditingPointIndex(index);
    setEditingPointText(currentText);
    setEditDialogOpen(true);
  };

  const submitEdit = async () => {
    if (editingPointIndex === null || !note?.key_points) return;
    const item = note.key_points[editingPointIndex];
    const original = typeof item === "object" && "point" in item ? item.point : (item as string);
    await handleFeedback(editingPointIndex, "edited", original, editingPointText);
    setEditDialogOpen(false);
    setEditingPointIndex(null);
    setEditingPointText("");
  };

  const mindMapData = useMemo(() => {
    if (!note) return null;
    return note.mind_map || buildMindMapFromNote(note);
  }, [note]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              笔记不存在
            </CardTitle>
            <CardDescription>未找到该笔记，可能已被删除</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回
                </Link>
              </Button>

              {editing ? (
                <div className="flex-1 max-w-xl">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    placeholder="笔记标题"
                  />
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold">{note.title}</h1>
                  <p className="text-sm text-muted-foreground">
                    {new Date(note.updated_at).toLocaleString("zh-CN")}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {note.status === "draft" && !analyzing && (
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  size="sm"
                  variant="outline"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  {analyzing ? "分析中..." : "AI分析"}
                </Button>
              )}

              {editing ? (
                <>
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditing(false);
                      setEditedTitle(note.title);
                      setEditedContent(note.content);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setEditing(true)} size="sm" variant="outline">
                    编辑
                  </Button>
                  <Button
                    onClick={handleTogglePublic}
                    disabled={sharing}
                    size="sm"
                    variant={note.is_public ? "default" : "outline"}
                    className={note.is_public ? "bg-slate-950 text-white hover:bg-slate-800" : ""}
                  >
                    {sharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
                    {note.is_public ? "已公开" : "公开分享"}
                  </Button>
                  {note.is_public && (
                    <Button onClick={handleCopyShareLink} size="sm" variant="outline">
                      <Copy className="h-4 w-4 mr-2" />
                      复制链接
                    </Button>
                  )}
                  <Button
                    onClick={handleDelete}
                    disabled={deleting}
                    size="sm"
                    variant="outline"
                    className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    移入回收站
                  </Button>

                  {/* 导出下拉菜单 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="default">
                        <Download className="h-4 w-4 mr-2" />
                        导出
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleDownloadMarkdown}>
                        <FileDown className="h-4 w-4 mr-2" />
                        下载 Markdown (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadHTML}>
                        <FileText className="h-4 w-4 mr-2" />
                        下载 HTML
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDownloadPDF}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        导出 PDF（打印）
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="content" className="space-y-6">
          <TabsList>
            <TabsTrigger value="content">内容</TabsTrigger>
            <TabsTrigger value="mindmap">思维导图</TabsTrigger>
            <TabsTrigger value="flashcards">知识卡片</TabsTrigger>
            <TabsTrigger value="analysis">AI分析</TabsTrigger>
            <TabsTrigger value="quiz">练习测验</TabsTrigger>
          </TabsList>

          {/* 内容标签页 */}
          <TabsContent value="content">
            {editing ? (
              <Card className="overflow-hidden">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>编辑笔记</CardTitle>
                      <CardDescription>支持 Markdown，右侧会实时渲染成阅读视图。</CardDescription>
                    </div>
                    <div className="flex rounded-md border bg-background p-1">
                      <Button
                        size="sm"
                        type="button"
                        variant={viewMode === "split" ? "default" : "ghost"}
                        onClick={() => setViewMode("split")}
                      >
                        <Columns2 className="h-4 w-4 mr-1" />
                        双栏
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant={viewMode === "preview" ? "default" : "ghost"}
                        onClick={() => setViewMode("preview")}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        预览
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant={viewMode === "source" ? "default" : "ghost"}
                        onClick={() => setViewMode("source")}
                      >
                        <PanelRightOpen className="h-4 w-4 mr-1" />
                        源码
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className={viewMode === "split" ? "grid lg:grid-cols-2" : ""}>
                    {viewMode !== "preview" && (
                      <div className="border-slate-200 lg:border-r dark:border-slate-800">
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          placeholder="笔记内容（支持 Markdown 格式）"
                          rows={25}
                          className="min-h-[680px] rounded-none border-0 p-6 font-mono text-sm leading-7 shadow-none focus-visible:ring-0"
                        />
                      </div>
                    )}
                    {viewMode !== "source" && (
                      <div className="min-h-[680px] bg-white p-6 dark:bg-slate-950">
                        <MarkdownRenderer content={editedContent} />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* 视图切换按钮 */}
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant={viewMode === "preview" ? "default" : "outline"}
                    onClick={() => setViewMode("preview")}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    预览
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "source" ? "default" : "outline"}
                    onClick={() => setViewMode("source")}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    源码
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-6">
                    {viewMode === "preview" ? (
                      <MarkdownRenderer content={note.content} />
                    ) : (
                      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                        {note.content}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 思维导图标签页 */}
          <TabsContent value="mindmap">
            <div className="space-y-6">
              <MindMapViewer data={mindMapData} />
              <TimelineViewer events={note.timeline || []} />
              <ComparisonViewer comparisons={note.comparisons || []} />
            </div>
          </TabsContent>

          {/* 知识卡片标签页 */}
          <TabsContent value="flashcards">
            <FlashcardViewer cards={note.flashcards || []} />
          </TabsContent>

          {/* AI分析标签页 */}
          <TabsContent value="analysis">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 摘要 */}
              <Card>
                <CardHeader>
                  <CardTitle>摘要</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.summary ? (
                    <p className="text-sm text-muted-foreground">{note.summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {note.status === "draft" ? "暂未分析" : "未生成摘要"}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* 标签 */}
              <Card>
                <CardHeader>
                  <CardTitle>标签</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.tags && note.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {note.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无标签</p>
                  )}
                </CardContent>
              </Card>

              {/* 主题 */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>关键主题</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.themes && note.themes.length > 0 ? (
                    <div className="space-y-3">
                      {note.themes.map((theme, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                              {Math.round(theme.importance * 100)}
                            </span>
                          </div>
                          <div>
                            <h4 className="font-semibold">{theme.name}</h4>
                            {theme.description && (
                              <p className="text-sm text-muted-foreground">{theme.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无主题</p>
                  )}
                </CardContent>
              </Card>

              {/* 关键要点 */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>关键要点</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.key_points && note.key_points.length > 0 ? (
                    <ul className="space-y-3">
                      {note.key_points.map((item, index) => {
                        // 兼容旧格式（string）和新格式（object）
                        const isNewFormat = typeof item === "object" && item !== null && "point" in item;
                        const pointText = isNewFormat ? (item as { point: string }).point : (item as string);
                        const sourceQuote = isNewFormat ? (item as { sourceQuote: string }).sourceQuote : null;
                        const confidence = isNewFormat ? (item as { confidence: number }).confidence : null;

                        return (
                          <li key={index} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-start gap-2">
                              <CheckCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                                confidence !== null && confidence < 0.7
                                  ? "text-yellow-500"
                                  : confidence !== null && confidence === 0
                                  ? "text-red-400"
                                  : "text-green-500"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${confidence === 0 ? "line-through text-muted-foreground" : ""}`}>
                                    {pointText}
                                  </span>
                                  {confidence !== null && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs flex-shrink-0 ${
                                        confidence === 0
                                          ? "bg-red-500/10 text-red-600 border-red-500/20"
                                          : confidence >= 0.8
                                          ? "bg-green-500/10 text-green-600 border-green-500/20"
                                          : confidence >= 0.7
                                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                          : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                                      }`}
                                    >
                                      {confidence === 0
                                        ? "已拒绝"
                                        : confidence >= 0.8 ? "高可信" : confidence >= 0.7 ? "中可信" : "待验证"}
                                      {confidence > 0 && ` ${Math.round(confidence * 100)}%`}
                                    </Badge>
                                  )}
                                </div>
                                {sourceQuote && (
                                  <div className="mt-2 pl-3 border-l-2 border-slate-300 dark:border-slate-600">
                                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                                      &ldquo;{sourceQuote}&rdquo;
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">— 原文出处</p>
                                  </div>
                                )}
                                {/* 反馈按钮 */}
                                <div className="mt-2 flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                    disabled={feedbackLoading === index}
                                    onClick={() => handleFeedback(index, "correct", pointText)}
                                  >
                                    <ThumbsUp className="h-3 w-3 mr-1" />
                                    正确
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={feedbackLoading === index}
                                    onClick={() => handleFeedback(index, "incorrect", pointText)}
                                  >
                                    <ThumbsDown className="h-3 w-3 mr-1" />
                                    错误
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    disabled={feedbackLoading === index}
                                    onClick={() => openEditDialog(index, pointText)}
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    修正
                                  </Button>
                                  {feedbackLoading === index && (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无关键要点</p>
                  )}
                </CardContent>
              </Card>

              {/* 状态 */}
              <Card>
                <CardHeader>
                  <CardTitle>状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant="outline"
                    className={
                      note.status === "organized"
                        ? "bg-purple-500/10 text-purple-500 border-purple-500/20"
                        : note.status === "processed"
                        ? "bg-green-500/10 text-green-500 border-green-500/20"
                        : note.status === "analyzing"
                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                        : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                    }
                  >
                    {note.status === "organized" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        已整理
                      </>
                    ) : note.status === "processed" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        已分析
                      </>
                    ) : note.status === "analyzing" ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        分析中
                      </>
                    ) : (
                      "草稿"
                    )}
                  </Badge>
                </CardContent>
              </Card>

              {/* 来源 */}
              <Card>
                <CardHeader>
                  <CardTitle>来源</CardTitle>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-muted-foreground">
                    {note.source_type === "text" && "文本输入"}
                    {note.source_type === "pdf" && "PDF导入"}
                    {note.source_type === "image" && "图片识别"}
                    {note.source_type === "url" && "URL抓取"}
                    {note.source_type === "mixed" && "多文件整合"}
                    {note.source_type === "audio" && "音频转写"}
                    {note.source_type === "video" && "视频分析"}
                  </span>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 知识要素标签页 */}
          <TabsContent value="entities">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">核心概念</CardTitle>
                  <CardDescription>优先展示对学习和复习有价值的概念、定义和来源。</CardDescription>
                </CardHeader>
                <CardContent>
                  {note.entities?.concepts && note.entities.concepts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {note.entities.concepts.map((concept, index) => (
                        <div key={index} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/concepts/${encodeURIComponent(concept.name)}`}
                              className="font-semibold text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
                            >
                              {concept.name}
                            </Link>
                            {concept.importance && (
                              <Badge variant="outline" className="text-xs">{concept.importance}</Badge>
                            )}
                          </div>
                          {concept.definition && (
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{concept.definition}</p>
                          )}
                          {concept.source && (
                            <p className="text-xs text-muted-foreground/70 mt-2">来源：{concept.source}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无核心概念。重新整合上传资料后会优先生成这一部分。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">公式与规则</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.formulas && note.entities.formulas.length > 0 ? (
                    <div className="space-y-3">
                      {note.entities.formulas.map((formula, index) => (
                        <div key={index} className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900">
                          <div className="font-semibold">{formula.name}</div>
                          {formula.expression && (
                            <code className="block mt-2 px-2 py-1 rounded bg-white/70 dark:bg-slate-900 text-sm overflow-x-auto">{formula.expression}</code>
                          )}
                          {formula.meaning && <p className="text-sm text-muted-foreground mt-2">{formula.meaning}</p>}
                          {formula.usage && <p className="text-xs text-muted-foreground/80 mt-1">用法：{formula.usage}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无公式或规则。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">方法与流程</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.methods && note.entities.methods.length > 0 ? (
                    <div className="space-y-3">
                      {note.entities.methods.map((method, index) => (
                        <div key={index} className="p-3 rounded-lg border bg-slate-50 dark:bg-slate-800/50">
                          <div className="font-semibold">{method.name}</div>
                          {method.scenario && <p className="text-xs text-muted-foreground mt-1">场景：{method.scenario}</p>}
                          {method.steps && method.steps.length > 0 && (
                            <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
                              {method.steps.map((step, stepIndex) => (
                                <li key={stepIndex}>{step}</li>
                              ))}
                            </ol>
                          )}
                          {method.notes && <p className="text-xs text-muted-foreground/80 mt-2">注意：{method.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无方法流程。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">易错点</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.pitfalls && note.entities.pitfalls.length > 0 ? (
                    <div className="space-y-3">
                      {note.entities.pitfalls.map((pitfall, index) => (
                        <div key={index} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900">
                          <div className="font-semibold text-red-700 dark:text-red-300">{pitfall.name}</div>
                          {pitfall.description && <p className="text-sm text-muted-foreground mt-2">{pitfall.description}</p>}
                          {pitfall.correction && <p className="text-sm mt-2">正确理解：{pitfall.correction}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无易错点。</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">应用场景</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.applications && note.entities.applications.length > 0 ? (
                    <div className="space-y-3">
                      {note.entities.applications.map((app, index) => (
                        <div key={index} className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900">
                          <div className="font-semibold">{app.name}</div>
                          {app.scenario && <p className="text-sm text-muted-foreground mt-2">{app.scenario}</p>}
                          {app.value && <p className="text-xs text-muted-foreground/80 mt-1">价值：{app.value}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无应用场景。</p>
                  )}
                </CardContent>
              </Card>
              {/* 人物 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">👤 人物</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.persons && note.entities.persons.length > 0 ? (
                    <div className="space-y-2">
                      {note.entities.persons.map((person, index) => (
                        <div key={index} className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-medium">{person.name}</span>
                          {person.position && (
                            <span className="text-sm text-muted-foreground ml-2">({person.position})</span>
                          )}
                          {person.relation && (
                            <p className="text-xs text-muted-foreground mt-1">{person.relation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无人物信息</p>
                  )}
                </CardContent>
              </Card>

              {/* 组织 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">🏢 组织机构</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.organizations && note.entities.organizations.length > 0 ? (
                    <div className="space-y-2">
                      {note.entities.organizations.map((org, index) => (
                        <div key={index} className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-medium">{org.name}</span>
                          {org.type && (
                            <Badge variant="outline" className="ml-2 text-xs">{org.type}</Badge>
                          )}
                          {org.description && (
                            <p className="text-xs text-muted-foreground mt-1">{org.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无组织信息</p>
                  )}
                </CardContent>
              </Card>

              {/* 地点 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">📍 地点</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.locations && note.entities.locations.length > 0 ? (
                    <div className="space-y-2">
                      {note.entities.locations.map((loc, index) => (
                        <div key={index} className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-medium">{loc.name}</span>
                          {loc.type && (
                            <Badge variant="outline" className="ml-2 text-xs">{loc.type}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无地点信息</p>
                  )}
                </CardContent>
              </Card>

              {/* 日期 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">📅 重要日期</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.dates && note.entities.dates.length > 0 ? (
                    <div className="space-y-2">
                      {note.entities.dates.map((date, index) => (
                        <div key={index} className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-medium">{date.date}</span>
                          {date.event && (
                            <p className="text-xs text-muted-foreground mt-1">{date.event}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无日期信息</p>
                  )}
                </CardContent>
              </Card>

              {/* 数值 */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">📊 关键数据</CardTitle>
                </CardHeader>
                <CardContent>
                  {note.entities?.numbers && note.entities.numbers.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {note.entities.numbers.map((num, index) => (
                        <div key={index} className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {num.value}{num.unit && <span className="text-sm ml-1">{num.unit}</span>}
                          </div>
                          {num.context && (
                            <p className="text-xs text-muted-foreground mt-1">{num.context}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">暂无数据信息</p>
                  )}
                </CardContent>
              </Card>

              {/* 待办任务 */}
              {note.tasks && note.tasks.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">✅ 待办事项</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {note.tasks.map((task, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <input
                            type="checkbox"
                            checked={task.status === "completed"}
                            readOnly
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="flex-1">{task.content}</span>
                          {task.assignee && (
                            <Badge variant="outline" className="text-xs">{task.assignee}</Badge>
                          )}
                          {task.deadline && (
                            <span className="text-xs text-muted-foreground">{task.deadline}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* 练习测验标签页 */}
          <TabsContent value="quiz">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  练习测验
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center py-8">
                <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  AI 根据笔记内容自动生成选择题、填空题和简答题，帮助你检验学习效果
                </p>
                <Button asChild>
                  <Link href={`/quiz/${noteId}`}>
                    <GraduationCap className="h-4 w-4 mr-2" />
                    进入练习测验
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 相关笔记推荐 */}
        <div className="mt-8">
          <RelatedNotes noteId={noteId} />
        </div>
      </main>

      {/* 修正知识点弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修正知识点</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingPointIndex !== null && note?.key_points?.[editingPointIndex] && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">原始内容：</span>
                {typeof note.key_points[editingPointIndex] === "object" && "point" in (note.key_points[editingPointIndex] as { point?: string })
                  ? (note.key_points[editingPointIndex] as { point: string }).point
                  : (note.key_points[editingPointIndex] as string)}
              </div>
            )}
            <Textarea
              value={editingPointText}
              onChange={(e) => setEditingPointText(e.target.value)}
              placeholder="输入修正后的知识点内容"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={submitEdit} disabled={!editingPointText.trim()}>
              提交修正
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
