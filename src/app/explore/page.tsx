"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GitFork, Network, Search, Sparkles, Tags, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type PublicLoop = {
  id: string;
  title: string;
  summary?: string | null;
  tags?: string[] | null;
  subject?: string | null;
  updated_at?: string | null;
  fork_count?: number | null;
};

export default function LearningLoopPlazaPage() {
  const [loops, setLoops] = useState<PublicLoop[]>([]);
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
        setLoops(data.notes || []);
        setTags(data.tags || []);
        setSubjects(data.subjects || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error loading public learning loops:", error);
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
      forks: loops.reduce((sum, loop) => sum + (loop.fork_count || 0), 0),
    };
  }, [loops, subjects.length, tags.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <BackButton variant="ghost">
<ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
              </BackButton>
          <Badge className="bg-slate-950 text-white hover:bg-slate-950">
            学习闭环广场
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 md:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <Badge className="mb-4 bg-amber-100 text-slate-950 hover:bg-amber-100">
                可 Fork 的学习空间模板
              </Badge>
              <h1 className="max-w-4xl text-3xl font-black leading-tight md:text-5xl">
                不只 Fork 一篇笔记，而是 Fork 一套可以继续学习的闭环。
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                每个公开内容会被当作一个学习闭环模板：包含学习主题、核心笔记、标签概念和初始学习计划。Fork 后系统会自动创建你的学习空间，并把材料带入其中。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-950 p-4 text-white">
                <p className="text-xs text-white/60">闭环模板</p>
                <p className="mt-2 text-2xl font-black">{loops.length}</p>
              </div>
              <div className="rounded-lg bg-cyan-50 p-4">
                <p className="text-xs text-cyan-700">学科</p>
                <p className="mt-2 text-2xl font-black">{stats.subjects}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">Fork</p>
                <p className="mt-2 text-2xl font-black">{stats.forks}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索学习主题、摘要、学科或概念标签"
                  className="h-11 rounded-lg border-slate-200 bg-white pl-11"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="h-full min-h-11 border-slate-200 bg-white"
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
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4" />
                  学科方向
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

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tags className="h-4 w-4" />
                  概念标签
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
                <Skeleton key={item} className="h-56 rounded-lg" />
              ))}
            </div>
          ) : loops.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {loops.map((loop) => (
                <Link key={loop.id} href={`/share/${loop.id}`}>
                  <Card className="h-full border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                          <Network className="mr-1 h-3 w-3" />
                          闭环模板
                        </Badge>
                        {loop.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{loop.subject}</Badge>}
                        <Badge variant="outline">
                          <GitFork className="mr-1 h-3 w-3" />
                          {loop.fork_count || 0}
                        </Badge>
                      </div>
                      <CardTitle className="line-clamp-2 text-xl">{loop.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600">
                        {loop.summary || "这个公开闭环暂时没有摘要，打开后可以查看核心材料并 Fork 成自己的学习空间。"}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {(loop.tags || []).slice(0, 6).map((tag) => (
                          <Badge key={tag} variant="outline">#{tag}</Badge>
                        ))}
                      </div>
                      <div className="mt-5 flex items-center text-sm font-semibold text-slate-800">
                        <Sparkles className="mr-2 h-4 w-4" />
                        查看并 Fork 学习闭环
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-slate-300 bg-white">
              <CardContent className="px-6 py-16 text-center">
                <Network className="mx-auto mb-4 h-12 w-12 text-slate-400" />
                <h2 className="text-xl font-black">还没有匹配的公开学习闭环</h2>
                <p className="mt-2 text-sm text-slate-500">换个关键词或清空筛选试试。</p>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
