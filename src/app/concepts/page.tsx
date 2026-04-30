"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Network, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

type Concept = {
  name: string;
  type: string;
  description?: string;
  noteCount: number;
  subjects: string[];
  avgConfidence?: number | null;
  latestUpdatedAt?: string | null;
  learningState: "weak" | "strong" | "unknown";
  masteryScore?: number | null;
};

function stateBadge(concept: Concept) {
  if (concept.learningState === "weak") {
    return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50">需要复习</Badge>;
  }
  if (concept.learningState === "strong") {
    return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">掌握较好</Badge>;
  }
  return <Badge variant="outline">待检测</Badge>;
}

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
        const response = await fetch(`/api/concepts${params}`, { signal: controller.signal });
        const data = await response.json();
        setConcepts(data.concepts || []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Error fetching concepts:", error);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const stats = useMemo(() => {
    return {
      weak: concepts.filter((concept) => concept.learningState === "weak").length,
      strong: concepts.filter((concept) => concept.learningState === "strong").length,
      totalLinks: concepts.reduce((sum, concept) => sum + concept.noteCount, 0),
    };
  }, [concepts]);

  return (
    <div className="min-h-screen bg-[#f4efe4] text-slate-950">
      <header className="border-b border-slate-950/10 bg-[#f8f1e6]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回工作台
            </Link>
          </Button>
          <Badge className="bg-slate-950 text-white hover:bg-slate-950">
            Obsidian-style Backlinks
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="rounded-[2rem] border border-slate-950/10 bg-white/75 p-7 shadow-xl shadow-slate-950/5">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <Badge className="mb-4 bg-[#f7c76b] text-slate-950 hover:bg-[#f7c76b]">
                概念网络
              </Badge>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                把分散笔记汇聚成可复习的知识节点
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                这里基于 AI 抽取的实体和知识点生成概念索引，点击任意概念即可查看反向链接、相关笔记、薄弱状态和延伸概念。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs text-white/60">概念数</p>
                <p className="mt-1 text-2xl font-black">{concepts.length}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-xs text-rose-600">薄弱点</p>
                <p className="mt-1 text-2xl font-black">{stats.weak}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">强项</p>
                <p className="mt-1 text-2xl font-black">{stats.strong}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.5rem] border border-slate-950/10 bg-white/75 p-4 shadow-xl shadow-slate-950/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索概念、术语、知识点..."
              className="h-12 rounded-2xl border-slate-950/10 bg-white pl-12"
            />
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Card key={item} className="border-slate-950/10 bg-white/75">
                <CardContent className="space-y-4 p-5">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : concepts.length === 0 ? (
          <Card className="border-dashed border-slate-950/20 bg-white/60">
            <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <Network className="mb-4 h-12 w-12 text-slate-400" />
              <h2 className="text-2xl font-black">还没有可展示的概念</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                先对笔记执行 AI 结构化分析，系统会从实体和知识点中生成概念索引。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {concepts.map((concept) => (
              <Link key={concept.name} href={`/concepts/${encodeURIComponent(concept.name)}`}>
                <Card className="h-full border-slate-950/10 bg-white/78 shadow-xl shadow-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-slate-950/10">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 text-xl">{concept.name}</CardTitle>
                      {stateBadge(concept)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-2 min-h-[2.5rem] text-sm leading-5 text-slate-600">
                      {concept.description || "暂无定义，打开后可查看出现位置和相关笔记。"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {concept.subjects.slice(0, 3).map((subject) => (
                        <Badge key={subject} variant="outline">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-950/10 pt-4 text-sm text-slate-500">
                      <span className="inline-flex items-center">
                        <Brain className="mr-1.5 h-4 w-4" />
                        {concept.noteCount} 篇笔记提到
                      </span>
                      <span className="inline-flex items-center font-semibold text-slate-800">
                        查看反链
                        <Sparkles className="ml-1.5 h-4 w-4" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
