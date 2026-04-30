"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitFork, Library, Search, Share2, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type PublicNote = {
  id: string;
  title: string;
  summary?: string | null;
  tags?: string[] | null;
  subject?: string | null;
  updated_at?: string | null;
  fork_count?: number | null;
};

export default function PublicNotesPage() {
  const [notes, setNotes] = useState<PublicNote[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [activeSubject, setActiveSubject] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (activeTag) params.set("tag", activeTag);
        if (activeSubject) params.set("subject", activeSubject);

        const response = await fetch(`/api/public-notes?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        setNotes(data.notes || []);
        setTags(data.tags || []);
        setSubjects(data.subjects || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error loading public notes:", error);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [activeSubject, activeTag, query]);

  const stats = useMemo(() => {
    return {
      subjects: subjects.length,
      tags: tags.length,
      forks: notes.reduce((sum, note) => sum + (note.fork_count || 0), 0),
    };
  }, [notes, subjects.length, tags.length]);

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="border-b border-slate-950/10 bg-[#fbf7ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回工作台
            </Link>
          </Button>
          <Badge className="bg-slate-950 text-white hover:bg-slate-950">
            协作笔记
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 md:px-8">
        <section className="rounded-2xl border border-slate-950/10 bg-white/80 p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-end">
            <div>
              <Badge className="mb-4 bg-[#f7c76b] text-slate-950 hover:bg-[#f7c76b]">
                公开笔记广场
              </Badge>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                浏览别人公开的学习笔记，一键 Fork 到自己的知识库。
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                按学科和主题标签发现可复用的笔记。Fork 后会生成你的私人副本，之后可以继续编辑、复习和生成测验。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs text-white/60">公开笔记</p>
                <p className="mt-2 text-2xl font-black">{notes.length}</p>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-4">
                <p className="text-xs text-cyan-700">学科</p>
                <p className="mt-2 text-2xl font-black">{stats.subjects}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Fork</p>
                <p className="mt-2 text-2xl font-black">{stats.forks}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <Card className="border-slate-950/10 bg-white/80 shadow-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索标题、摘要、学科或标签"
                  className="h-12 rounded-xl border-slate-950/10 bg-white pl-11"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="h-full min-h-12 border-slate-950/10 bg-white/80"
            onClick={() => {
              setActiveTag("");
              setActiveSubject("");
              setQuery("");
            }}
          >
            清空筛选
          </Button>
        </section>

        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="border-slate-950/10 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Library className="h-4 w-4" />
                  学科
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {subjects.length ? (
                  subjects.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => setActiveSubject(subject === activeSubject ? "" : subject)}
                    >
                      <Badge className={subject === activeSubject ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}>
                        {subject}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">暂无学科分类</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-950/10 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tags className="h-4 w-4" />
                  主题标签
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {tags.length ? (
                  tags.map((tag) => (
                    <button key={tag} type="button" onClick={() => setActiveTag(tag === activeTag ? "" : tag)}>
                      <Badge className={tag === activeTag ? "bg-slate-950 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"}>
                        #{tag}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">暂无标签</p>
                )}
              </CardContent>
            </Card>
          </aside>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-48 rounded-2xl" />
              ))}
            </div>
          ) : notes.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {notes.map((note) => (
                <Link key={note.id} href={`/share/${note.id}`}>
                  <Card className="h-full border-slate-950/10 bg-white/80 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="mb-2 flex flex-wrap gap-2">
                        {note.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{note.subject}</Badge>}
                        <Badge variant="outline">
                          <GitFork className="mr-1 h-3 w-3" />
                          {note.fork_count || 0}
                        </Badge>
                      </div>
                      <CardTitle className="line-clamp-2 text-xl">{note.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">
                        {note.summary || "这篇公开笔记暂时没有摘要，打开后可以查看完整内容。"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(note.tags || []).slice(0, 5).map((tag) => (
                          <Badge key={tag} variant="outline">#{tag}</Badge>
                        ))}
                      </div>
                      <div className="mt-5 flex items-center text-sm font-semibold text-slate-800">
                        <Share2 className="mr-2 h-4 w-4" />
                        查看并 Fork
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-slate-950/20 bg-white/70">
              <CardContent className="px-6 py-16 text-center">
                <Share2 className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <h2 className="text-xl font-black">还没有匹配的公开笔记</h2>
                <p className="mt-2 text-sm text-slate-500">换个关键词或清空筛选试试。</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
