"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  tags?: string[] | null;
  subject?: string | null;
  source_type?: string | null;
  status: string;
  flashcards?: Array<{ question?: string; answer?: string }> | null;
  key_points?: Array<{ point?: string; sourceQuote?: string }> | string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DueCard = {
  note_id: string;
  due_date?: string | null;
  priority?: "high" | "normal";
};

type WeakConcept = {
  concept: string;
  score?: number;
};

type ViewMode = "all" | "subject" | "review" | "weak";

const viewOptions: Array<{ value: ViewMode; label: string }> = [
  { value: "all", label: "全部" },
  { value: "subject", label: "按学科" },
  { value: "review", label: "待复习" },
  { value: "weak", label: "薄弱点相关" },
];

function formatDate(value?: string | null) {
  if (!value) return "未知时间";
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "processed":
      return "已分析";
    case "organized":
      return "已整理";
    case "analyzing":
      return "分析中";
    default:
      return status;
  }
}

function sourceLabel(source?: string | null) {
  switch (source) {
    case "pdf":
      return "PDF";
    case "image":
      return "图片";
    case "url":
      return "网页";
    case "mixed":
      return "混合资料";
    default:
      return "文本";
  }
}

function noteSearchText(note: NoteRow) {
  const keyPoints = (note.key_points || [])
    .map((item) => (typeof item === "string" ? item : item.point || ""))
    .join(" ");

  return [
    note.title,
    note.summary,
    note.content,
    note.subject,
    ...(note.tags || []),
    keyPoints,
  ].filter(Boolean).join(" ").toLowerCase();
}

function NoteCard({
  note,
  due,
  deleting,
  onDelete,
}: {
  note: NoteRow;
  due?: DueCard;
  deleting?: boolean;
  onDelete: (note: NoteRow) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-950/10 bg-white/78 p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/notes/${note.id}`} className="min-w-0 flex-1">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                {statusLabel(note.status)}
              </Badge>
              <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                {note.subject || "未分类"}
              </Badge>
              <Badge variant="outline">{sourceLabel(note.source_type)}</Badge>
              {due && (
                <Badge className={due.priority === "high" ? "bg-rose-50 text-rose-700 hover:bg-rose-50" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"}>
                  今日复习
                </Badge>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(note.updated_at || note.created_at)}
              </span>
            </div>

            <h2 className="line-clamp-1 text-xl font-black">{note.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
              {note.summary || note.content || "这篇笔记还没有摘要，进入详情页后可以继续分析和整理。"}
            </p>

            {note.tags?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {note.tags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2 pt-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            disabled={deleting}
            title="移入回收站"
            onClick={() => onDelete(note)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <ChevronRight className="h-5 w-5 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed border-slate-950/20 bg-white/70">
      <CardContent className="px-6 py-16 text-center">
        <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <h2 className="text-lg font-black">没有找到笔记</h2>
        <p className="mt-2 text-sm text-slate-500">可以换一个视图或关键词，或者上传/新建一篇学习资料。</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/upload/batch">
              <Upload className="mr-2 h-4 w-4" />
              上传资料
            </Link>
          </Button>
          <Button asChild>
            <Link href="/notes/new">
              <FileText className="mr-2 h-4 w-4" />
              新建笔记
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NotesContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [dueCards, setDueCards] = useState<DueCard[]>([]);
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ limit: "100" });
    if (sessionId) params.set("sessionId", sessionId);

    try {
      const [notesRes, reviewRes, profileRes] = await Promise.all([
        fetch(`/api/notes?${params.toString()}`),
        fetch("/api/review?dueOnly=1"),
        fetch("/api/profile"),
      ]);

      const notesData = await notesRes.json();
      const reviewData = await reviewRes.json();
      const profileData = await profileRes.json();

      if (!notesRes.ok) {
        setError(notesData.error || "获取笔记失败");
        setNotes([]);
        return;
      }

      setNotes(notesData.notes || []);
      setDueCards(reviewData.cards || []);
      setWeakConcepts(profileData.profile?.weak_concepts || profileData.profile?.weakConcepts || []);
    } catch (fetchError) {
      console.error("Error fetching notes:", fetchError);
      setError("获取笔记失败，请稍后重试");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  const dueByNoteId = useMemo(() => {
    const map = new Map<string, DueCard>();
    for (const card of dueCards) {
      if (!map.has(card.note_id) || card.priority === "high") map.set(card.note_id, card);
    }
    return map;
  }, [dueCards]);

  const visibleNotes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const weakTerms = weakConcepts.map((item) => item.concept.toLowerCase()).filter(Boolean);

    return notes.filter((note) => {
      const text = noteSearchText(note);
      if (keyword && !text.includes(keyword)) return false;
      if (view === "review") return dueByNoteId.has(note.id);
      if (view === "weak") return weakTerms.some((term) => text.includes(term) || term.includes(note.title.toLowerCase()));
      return true;
    });
  }, [dueByNoteId, notes, query, view, weakConcepts]);

  const groupedBySubject = useMemo(() => {
    const groups = new Map<string, NoteRow[]>();
    for (const note of visibleNotes) {
      const subject = note.subject || "未分类";
      groups.set(subject, [...(groups.get(subject) || []), note]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "zh-CN"));
  }, [visibleNotes]);

  const handleDeleteNote = useCallback(
    async (note: NoteRow) => {
      if (!window.confirm(`确定把「${note.title}」移入回收站吗？`)) return;

      setDeletingId(note.id);
      setError("");

      try {
        const response = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data.error || "删除笔记失败");
          return;
        }

        setNotes((current) => current.filter((item) => item.id !== note.id));
        setDueCards((current) => current.filter((item) => item.note_id !== note.id));
      } catch (deleteError) {
        console.error("Error deleting note:", deleteError);
        setError("删除笔记失败，请稍后重试");
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#f4efe4] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-950/10 bg-[#f8f1e6]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">学习资料库</h1>
                {sessionId && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">本次上传</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-600">像 Notion 数据库一样查看资料，按学科、复习状态和薄弱点切换视图。</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-950/15 bg-white/60" asChild>
              <Link href="/trash">
                <Trash2 className="mr-2 h-4 w-4" />
                回收站
              </Link>
            </Button>
            <Button variant="outline" className="border-slate-950/15 bg-white/60" asChild>
              <Link href="/upload/batch">
                <Upload className="mr-2 h-4 w-4" />
                上传资料
              </Link>
            </Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" asChild>
              <Link href="/notes/new">
                <Plus className="mr-2 h-4 w-4" />
                新建笔记
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-8">
        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、摘要、正文、学科、标签或 [[概念]]"
              className="h-12 rounded-2xl border-slate-950/10 bg-white/80 pl-12"
            />
          </div>

          <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
            <TabsList className="h-12 rounded-2xl border border-slate-950/10 bg-white/65 p-1">
              {viewOptions.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="rounded-xl px-4">
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </section>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-950 p-4 text-white">
            <p className="text-sm text-white/60">当前视图</p>
            <p className="mt-2 text-2xl font-black">{visibleNotes.length}</p>
          </div>
          <div className="rounded-2xl bg-white/75 p-4">
            <p className="text-sm text-slate-500">学科分组</p>
            <p className="mt-2 text-2xl font-black">{new Set(notes.map((note) => note.subject || "未分类")).size}</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-sm text-emerald-700">待复习</p>
            <p className="mt-2 text-2xl font-black">{new Set(dueCards.map((card) => card.note_id)).size}</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4">
            <p className="text-sm text-rose-700">薄弱概念</p>
            <p className="mt-2 text-2xl font-black">{weakConcepts.length}</p>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        )}

        {view === "weak" && weakConcepts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <Target className="h-4 w-4 text-rose-600" />
            {weakConcepts.slice(0, 10).map((item) => (
              <Link key={item.concept} href={`/concepts/${encodeURIComponent(item.concept)}`}>
                <Badge className="bg-white text-rose-700 hover:bg-white">[[{item.concept}]]</Badge>
              </Link>
            ))}
          </div>
        )}

        <section className="space-y-3">
          {loading ? (
            [1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32 rounded-2xl" />)
          ) : view === "subject" ? (
            groupedBySubject.length ? (
              groupedBySubject.map(([subject, items]) => (
                <div key={subject} className="space-y-3">
                  <div className="flex items-center gap-2 pt-2">
                    <FolderOpen className="h-4 w-4 text-slate-500" />
                    <h2 className="text-lg font-black">{subject}</h2>
                    <Badge variant="outline">{items.length} 篇</Badge>
                  </div>
                  {items.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      due={dueByNoteId.get(note.id)}
                      deleting={deletingId === note.id}
                      onDelete={handleDeleteNote}
                    />
                  ))}
                </div>
              ))
            ) : (
              <EmptyState />
            )
          ) : visibleNotes.length ? (
            visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                due={dueByNoteId.get(note.id)}
                deleting={deletingId === note.id}
                onDelete={handleDeleteNote}
              />
            ))
          ) : (
            <EmptyState />
          )}
        </section>
      </main>
    </div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4efe4] p-8 text-slate-600">正在加载笔记...</div>}>
      <NotesContent />
    </Suspense>
  );
}
