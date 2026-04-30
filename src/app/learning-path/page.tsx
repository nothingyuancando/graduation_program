"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Map,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LearningTask = {
  title: string;
  description: string;
  type: "review" | "learn" | "practice" | "quiz" | "project";
  noteIds?: string[];
  minutes?: number;
};

type LearningPlan = {
  goal: string;
  days: Array<{
    day: number;
    focus: string;
    objective: string;
    tasks: LearningTask[];
    checkpoints: string[];
  }>;
  prerequisites: string[];
  weakPoints: string[];
  recommendedNotes: Array<{
    id: string;
    title: string;
    subject?: string | null;
    reason: string;
  }>;
  strategy: string;
};

function taskTypeText(type: LearningTask["type"]) {
  const map = {
    review: "复习",
    learn: "学习",
    practice: "练习",
    quiz: "测验",
    project: "输出",
  };
  return map[type] || type;
}

function taskTypeClass(type: LearningTask["type"]) {
  switch (type) {
    case "review":
      return "bg-sky-50 text-sky-700";
    case "learn":
      return "bg-emerald-50 text-emerald-700";
    case "practice":
      return "bg-amber-50 text-amber-700";
    case "quiz":
      return "bg-rose-50 text-rose-700";
    case "project":
      return "bg-slate-950 text-white";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function LearningPathPage() {
  const [goal, setGoal] = useState("");
  const [days, setDays] = useState("7");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const goalFromQuery = new URLSearchParams(window.location.search).get("goal");
    if (goalFromQuery) {
      setGoal(goalFromQuery);
    }
  }, []);

  const generatePlan = async () => {
    if (!goal.trim()) {
      setError("请先输入学习目标");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/learning-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, days: Number(days) || 7 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "生成失败");
      }
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4efe4] text-slate-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-24 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-[#f7c76b]/35 blur-3xl" />
        <div className="absolute right-[-12rem] top-20 h-[36rem] w-[36rem] rounded-full bg-[#8fc6b5]/30 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-slate-950/10 bg-[#f8f1e6]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Button variant="ghost" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Link>
          </Button>
          <Badge className="bg-slate-950 text-white hover:bg-slate-950">
            LearningPathAgent
          </Badge>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl space-y-6 px-5 py-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-950/10 bg-white/70 p-7 shadow-2xl shadow-slate-950/5 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <Badge className="mb-4 bg-[#f7c76b] text-slate-950 hover:bg-[#f7c76b]">
                渐进式学习路径
              </Badge>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                从薄弱点出发，把目标拆成每天能完成的学习计划。
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
                系统会读取技能画像、学习画像、薄弱概念和已有笔记，生成从前置知识到综合输出的渐进式路径。
              </p>
            </div>

            <Card className="border-slate-950/10 bg-white/75">
              <CardContent className="space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-bold">学习目标</label>
                  <Input
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    placeholder="例如：7 天掌握数据库索引优化"
                    className="h-11 rounded-2xl"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold">计划天数</label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                    className="h-11 rounded-2xl"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button
                  onClick={generatePlan}
                  disabled={loading}
                  className="h-11 w-full rounded-2xl bg-slate-950 text-white hover:bg-slate-800"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  {loading ? "正在生成路径..." : "生成学习路径"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {plan && (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              <Card className="border-slate-950/10 bg-slate-950 text-white shadow-xl shadow-slate-950/10 lg:col-span-2">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-[#f7c76b]">
                    <Map className="h-5 w-5" />
                    <span className="text-sm font-bold">整体策略</span>
                  </div>
                  <h2 className="text-2xl font-black">{plan.goal}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/75">{plan.strategy}</p>
                </CardContent>
              </Card>

              <Card className="border-slate-950/10 bg-white/75 shadow-xl shadow-slate-950/5">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-rose-600" />
                    <p className="font-bold">优先补齐</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(plan.weakPoints.length ? plan.weakPoints : plan.prerequisites).slice(0, 8).map((item) => (
                      <Badge key={item} className="bg-rose-50 text-rose-700 hover:bg-rose-50">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {plan.recommendedNotes.length > 0 && (
              <Card className="border-slate-950/10 bg-white/75 shadow-xl shadow-slate-950/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    推荐复习笔记
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {plan.recommendedNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="rounded-2xl border border-slate-950/10 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold">{note.title}</p>
                        {note.subject && <Badge variant="outline">{note.subject}</Badge>}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{note.reason}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}

            <section className="space-y-4">
              {plan.days.map((day) => (
                <Card key={day.day} className="border-slate-950/10 bg-white/75 shadow-xl shadow-slate-950/5">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <Badge className="mb-2 bg-slate-950 text-white hover:bg-slate-950">
                          Day {day.day}
                        </Badge>
                        <h3 className="text-2xl font-black">{day.focus}</h3>
                        <p className="mt-1 text-sm text-slate-600">{day.objective}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-bold">
                        <Clock className="h-4 w-4" />
                        {day.tasks.reduce((sum, task) => sum + (task.minutes || 0), 0) || 120} min
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      {day.tasks.map((task, index) => (
                        <div key={index} className="rounded-2xl border border-slate-950/10 bg-slate-50 p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Badge className={taskTypeClass(task.type)}>{taskTypeText(task.type)}</Badge>
                            {task.minutes && (
                              <span className="text-xs text-slate-500">{task.minutes} min</span>
                            )}
                          </div>
                          <p className="font-bold">{task.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                          {task.noteIds && task.noteIds.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {task.noteIds.map((noteId) => (
                                <Button key={noteId} variant="outline" size="sm" className="rounded-full" asChild>
                                  <Link href={`/notes/${noteId}`}>打开笔记</Link>
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {day.checkpoints.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-950/10 pt-4">
                        {day.checkpoints.map((checkpoint) => (
                          <span key={checkpoint} className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            {checkpoint}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          </>
        )}

        {!plan && !loading && (
          <Card className="border-dashed border-slate-950/20 bg-white/50">
            <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <CalendarDays className="mb-4 h-12 w-12 text-slate-400" />
              <h2 className="text-xl font-black">输入目标后生成你的第一条学习路径</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">
                例如“10 天准备数据结构考试”“两周补齐机器学习基础”“7 天掌握数据库索引优化”。
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
