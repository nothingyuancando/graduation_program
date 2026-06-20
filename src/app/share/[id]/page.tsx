"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, BookOpenCheck, GitFork, Loader2, Network, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SharedLoop = {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[] | null;
  subject?: string | null;
  key_points?: Array<string | { point?: string }> | null;
  updated_at?: string | null;
  fork_count?: number | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, rawConcept: string) => {
      const concept = rawConcept.trim();
      return `<a href="/concepts/${encodeURIComponent(concept)}" class="rounded-md bg-cyan-50 px-1.5 py-0.5 font-medium text-cyan-700 no-underline hover:bg-cyan-100">[[${escapeHtml(concept)}]]</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">$1</code>');
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) {
        html.push('<ul class="my-3 list-disc space-y-1 pl-5">');
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    if (!line.trim()) {
      html.push("");
    } else if (line.startsWith("### ")) {
      html.push(`<h3 class="mt-6 text-xl font-black">${renderInlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      html.push(`<h2 class="mt-8 border-l-4 border-slate-950 pl-3 text-2xl font-black">${renderInlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      html.push(`<h1 class="mb-4 text-3xl font-black">${renderInlineMarkdown(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      html.push(`<blockquote class="my-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-slate-700">${renderInlineMarkdown(line.slice(2))}</blockquote>`);
    } else {
      html.push(`<p class="my-3 leading-8 text-slate-700">${renderInlineMarkdown(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function keyPointText(item: string | { point?: string }) {
  return typeof item === "string" ? item : item.point || "";
}

export default function SharedLoopPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const [loop, setLoop] = useState<SharedLoop | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/public-notes/${noteId}`);
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "公开学习闭环不存在");
          return;
        }
        setLoop(data.note);
      } catch (loadError) {
        console.error("Error loading shared loop:", loadError);
        setError("加载公开学习闭环失败");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [noteId]);

  const concepts = useMemo(() => {
    if (!loop) return [];
    const keyPoints = Array.isArray(loop.key_points) ? loop.key_points.map(keyPointText) : [];
    return [...new Set([...(loop.tags || []), ...keyPoints].map((item) => item.trim()).filter(Boolean))].slice(0, 12);
  }, [loop]);

  const handleFork = async () => {
    setForking(true);
    setError("");
    try {
      const response = await fetch(`/api/public-notes/${noteId}/fork`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Fork 失败，请确认已经登录");
        return;
      }
      router.push(data.goal?.id ? `/goals/${data.goal.id}` : `/notes/${data.note.id}`);
    } catch (forkError) {
      console.error("Error forking learning loop:", forkError);
      setError("Fork 失败，请稍后重试");
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <BackButton variant="ghost" fallbackHref="/explore">
<ArrowLeft className="mr-2 h-4 w-4" />
              学习闭环广场
              </BackButton>
          <Button onClick={handleFork} disabled={forking || !loop} className="bg-slate-950 text-white hover:bg-slate-800">
            {forking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4" />}
            Fork 为我的学习空间
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : error && !loop ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center text-red-700">{error}</CardContent>
          </Card>
        ) : loop ? (
          <>
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                  <Network className="mr-1 h-3 w-3" />
                  公开学习闭环
                </Badge>
                {loop.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{loop.subject}</Badge>}
                <Badge variant="outline">
                  <GitFork className="mr-1 h-3 w-3" />
                  {loop.fork_count || 0} Fork
                </Badge>
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">{loop.title}</h1>
              {loop.summary && <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{loop.summary}</p>}
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>核心材料</CardTitle>
                </CardHeader>
                <CardContent>
                  <article
                    className="max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(loop.content || "") }}
                  />
                </CardContent>
              </Card>

              <aside className="space-y-6">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-5 w-5 text-cyan-700" />
                      Fork 后会得到
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">一个新的学习空间</p>
                      <p>自动创建学习目标、知识点清单和初始 2 天学习计划。</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">一篇核心笔记</p>
                      <p>公开材料会复制到你的私人知识库，后续可编辑、复述和生成测验。</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="font-bold text-slate-950">闭环入口</p>
                      <p>进入空间后继续完成知识摄入、深度理解、主动回忆和弱点补强。</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpenCheck className="h-5 w-5 text-emerald-700" />
                      相关概念
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {concepts.length ? (
                      concepts.map((concept) => <Badge key={concept} variant="outline">#{concept}</Badge>)
                    ) : (
                      <p className="text-sm text-slate-500">暂无概念标签</p>
                    )}
                  </CardContent>
                </Card>

                <Button onClick={handleFork} disabled={forking || !loop} className="h-12 w-full bg-slate-950 text-white hover:bg-slate-800">
                  {forking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Fork 并开始学习
                </Button>
              </aside>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
