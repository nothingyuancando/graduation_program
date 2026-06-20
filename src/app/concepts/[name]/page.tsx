"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, Brain, ChevronRight, GraduationCap, Network, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ConceptDetail = {
  concept: {
    name: string;
    description?: string;
    learningState: "weak" | "strong" | "unknown";
    masteryScore?: number | null;
    noteCount: number;
    quizWeakCount: number;
  };
  backlinks: Array<{
    id: string;
    title: string;
    summary?: string;
    subject?: string;
    tags?: string[];
    updatedAt?: string;
    matchingEntities: Array<{ entity_name: string; description?: string }>;
    matchingKeyPoints: Array<{ point: string; sourceQuote?: string; confidence?: number }>;
  }>;
  relatedConcepts: Array<{ name: string; type: string; count: number }>;
};

function stateText(state: ConceptDetail["concept"]["learningState"]) {
  if (state === "weak") return "需要复习";
  if (state === "strong") return "掌握较好";
  return "待检测";
}

function stateClass(state: ConceptDetail["concept"]["learningState"]) {
  if (state === "weak") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  if (state === "strong") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

export default function ConceptDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name as string);
  const [detail, setDetail] = useState<ConceptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/concepts/${encodeURIComponent(name)}`);
        const data = await response.json();
        setDetail(data);
      } catch (error) {
        console.error("Error fetching concept detail:", error);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [name]);

  if (loading || !detail?.concept) {
    return (
      <div className="min-h-screen bg-[#f4efe4] px-6 py-8">
        <div className="mx-auto max-w-6xl space-y-5">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  const mastery =
    detail.concept.masteryScore == null
      ? null
      : Math.max(0, Math.min(100, Math.round(detail.concept.masteryScore * 100)));

  return (
    <div className="min-h-screen bg-[#f4efe4] text-slate-950">
      <header className="border-b border-slate-950/10 bg-[#f8f1e6]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BackButton variant="ghost" fallbackHref="/concepts">
<ArrowLeft className="mr-2 h-4 w-4" />
              返回概念网络
              </BackButton>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" asChild>
            <Link href={`/learning-path?goal=${encodeURIComponent(`复习 ${detail.concept.name}`)}`}>
              <Sparkles className="mr-2 h-4 w-4" />
              生成学习路径
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <section className="rounded-[2rem] border border-slate-950/10 bg-white/78 p-7 shadow-xl shadow-slate-950/5">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
            <div>
              <Badge className={stateClass(detail.concept.learningState)}>
                {stateText(detail.concept.learningState)}
              </Badge>
              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                {detail.concept.name}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
                {detail.concept.description || "系统暂未形成稳定定义。可以先查看下方反向链接，从多篇笔记中补全这个概念。"}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <p className="text-xs text-white/60">关联笔记</p>
                <p className="mt-1 text-2xl font-black">{detail.concept.noteCount}</p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-xs text-rose-600">相关错题</p>
                <p className="mt-1 text-2xl font-black">{detail.concept.quizWeakCount}</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">掌握度</p>
                <p className="mt-1 text-2xl font-black">{mastery == null ? "--" : `${mastery}%`}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">反向链接</h2>
              <Badge variant="outline">{detail.backlinks.length} 篇笔记</Badge>
            </div>

            {detail.backlinks.length === 0 ? (
              <Card className="border-dashed border-slate-950/20 bg-white/60">
                <CardContent className="py-14 text-center">
                  <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-400" />
                  <p className="font-bold">还没有笔记关联这个概念</p>
                </CardContent>
              </Card>
            ) : (
              detail.backlinks.map((note) => (
                <Link key={note.id} href={`/notes/${note.id}`} className="block">
                  <Card className="border-slate-950/10 bg-white/78 shadow-xl shadow-slate-950/5 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-slate-950/10">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-2 flex flex-wrap gap-2">
                            {note.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{note.subject}</Badge>}
                            {note.tags?.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                          <h3 className="text-xl font-black">{note.title}</h3>
                        </div>
                        <ChevronRight className="mt-2 h-5 w-5 text-slate-400" />
                      </div>

                      {note.summary && (
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{note.summary}</p>
                      )}

                      {note.matchingKeyPoints.length > 0 && (
                        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-4">
                          {note.matchingKeyPoints.map((point, index) => (
                            <div key={index}>
                              <p className="text-sm font-semibold">{point.point}</p>
                              {point.sourceQuote && (
                                <p className="mt-1 border-l-2 border-slate-300 pl-3 text-xs italic text-slate-500">
                                  {point.sourceQuote}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <Card className="border-slate-950/10 bg-slate-950 text-white shadow-xl shadow-slate-950/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-[#f7c76b]" />
                  学习动作
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detail.backlinks[0] && (
                  <Button className="w-full justify-start bg-white text-slate-950 hover:bg-white/90" asChild>
                    <Link href={`/quiz/${detail.backlinks[0].id}`}>
                      <GraduationCap className="mr-2 h-4 w-4" />
                      用相关笔记生成测验
                    </Link>
                  </Button>
                )}
                <Button className="w-full justify-start bg-white/10 text-white hover:bg-white/15" asChild>
                  <Link href={`/chat?prompt=${encodeURIComponent(`解释 ${detail.concept.name}，并结合我的笔记指出易错点`)}`}>
                    <Brain className="mr-2 h-4 w-4" />
                    让 Agent 解释易错点
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-950/10 bg-white/78 shadow-xl shadow-slate-950/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5" />
                  相关概念
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {detail.relatedConcepts.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无相关概念。</p>
                ) : (
                  detail.relatedConcepts.map((concept) => (
                    <Link key={concept.name} href={`/concepts/${encodeURIComponent(concept.name)}`}>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {concept.name} · {concept.count}
                      </Badge>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
