"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  Map,
  Plus,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CognitiveLevel = "remember" | "understand" | "apply" | "analyze";

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

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  cognitive_level: CognitiveLevel;
  status: "active" | "completed" | "paused" | "archived";
  deadline?: string | null;
  knowledge_points?: string[];
  daily_plan?: LearningPlan["days"];
  progress: number;
  updated_at: string;
};

const levelOptions: Array<{ value: CognitiveLevel; label: string; description: string }> = [
  { value: "remember", label: "了解", description: "知道定义、术语和基本事实" },
  { value: "understand", label: "理解", description: "能用自己的话解释概念和关系" },
  { value: "apply", label: "应用", description: "能用知识解决题目或实际问题" },
  { value: "analyze", label: "分析", description: "能比较、拆解并判断适用边界" },
];

function splitKnowledgePoints(value: string) {
  return value
    .split(/[\n,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function levelLabel(level: CognitiveLevel) {
  return levelOptions.find((item) => item.value === level)?.label || level;
}

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

function formatDate(value?: string | null) {
  if (!value) return "未设置";
  return new Date(value).toLocaleDateString("zh-CN");
}

export default function GoalsPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>("understand");
  const [deadline, setDeadline] = useState("");
  const [days, setDays] = useState("7");
  const [knowledgeInput, setKnowledgeInput] = useState("");
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    async function loadGoals() {
      setLoadingGoals(true);
      try {
        const response = await fetch("/api/learning-goals");
        const data = await response.json();
        if (!data.error) setGoals(data.goals || []);
      } finally {
        setLoadingGoals(false);
      }
    }

    void loadGoals();
  }, []);

  const knowledgePoints = useMemo(() => {
    const manual = splitKnowledgePoints(knowledgeInput);
    const generated = [...(plan?.prerequisites || []), ...(plan?.weakPoints || [])];
    return [...new Set([...manual, ...generated])].slice(0, 30);
  }, [knowledgeInput, plan]);

  const generatePlan = async () => {
    if (!title.trim()) {
      setError("请先输入学习目标。");
      return;
    }

    setGenerating(true);
    setError("");
    setSavedMessage("");
    try {
      const response = await fetch("/api/learning-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: `${title.trim()}。认知层级：${levelLabel(cognitiveLevel)}。${description.trim()}`,
          days: Number(days) || 7,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "生成学习计划失败");
      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成学习计划失败");
    } finally {
      setGenerating(false);
    }
  };

  const saveGoal = async () => {
    if (!title.trim()) {
      setError("请先输入学习目标。");
      return;
    }

    setSaving(true);
    setError("");
    setSavedMessage("");
    try {
      const response = await fetch("/api/learning-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          cognitiveLevel,
          deadline: deadline || null,
          knowledgePoints,
          dailyPlan: plan?.days || [],
          progress: 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存学习目标失败");
      setGoals((current) => [data.goal, ...current]);
      setSavedMessage("学习目标已保存，后续复述、测验和掌握度都可以关联到它。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存学习目标失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-black">学习目标与规划</h1>
              <p className="text-sm text-slate-500">闭环第一阶段：把“想学什么”变成可跟踪的目标。</p>
            </div>
          </div>
          <Button className="bg-slate-950 text-white hover:bg-slate-800" asChild>
            <Link href="/feynman">进入费曼复述</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-700" />
                新建学习目标
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                <div>
                  <Label htmlFor="title">目标名称</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="例如：两周掌握数据库事务与并发控制"
                  />
                </div>
                <div>
                  <Label htmlFor="days">计划天数</Label>
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={30}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">目标说明</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="写清楚学习背景、考试/项目要求、已有基础和希望达到的程度。"
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <Label>认知层级</Label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {levelOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCognitiveLevel(option.value)}
                        className={`rounded-lg border p-3 text-left transition ${
                          cognitiveLevel === option.value
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className="font-bold">{option.label}</p>
                        <p className={`mt-1 text-xs leading-5 ${cognitiveLevel === option.value ? "text-white/65" : "text-slate-500"}`}>
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="deadline">截止日期</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                  <Label htmlFor="knowledge" className="mt-4 block">
                    已知知识点
                  </Label>
                  <Textarea
                    id="knowledge"
                    value={knowledgeInput}
                    onChange={(event) => setKnowledgeInput(event.target.value)}
                    placeholder="每行一个，例如：ACID、隔离级别、MVCC"
                    rows={6}
                  />
                </div>
              </div>

              {knowledgePoints.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold">知识点清单</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {knowledgePoints.map((point) => (
                      <Badge key={point} className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                        {point}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
              {savedMessage && <p className="text-sm text-emerald-700">{savedMessage}</p>}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={generatePlan}
                  disabled={generating || saving}
                  className="bg-slate-950 text-white hover:bg-slate-800"
                >
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  生成学习计划
                </Button>
                <Button type="button" variant="outline" onClick={saveGoal} disabled={saving || generating}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  保存目标
                </Button>
              </div>
            </CardContent>
          </Card>

          {plan && (
            <section className="space-y-4">
              <Card className="border-slate-200 bg-slate-950 text-white shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-amber-300">
                    <Map className="h-5 w-5" />
                    <span className="text-sm font-bold">整体策略</span>
                  </div>
                  <h2 className="text-2xl font-black">{plan.goal}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/75">{plan.strategy}</p>
                </CardContent>
              </Card>

              {plan.days.map((day) => (
                <Card key={day.day} className="border-slate-200 bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <Badge className="mb-2 bg-slate-950 text-white hover:bg-slate-950">
                          Day {day.day}
                        </Badge>
                        <h3 className="text-xl font-black">{day.focus}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{day.objective}</p>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">
                        <Clock className="h-4 w-4" />
                        {day.tasks.reduce((sum, task) => sum + (task.minutes || 0), 0) || 120} min
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                      {day.tasks.map((task, index) => (
                        <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <Badge className="mb-2 bg-white text-slate-700 hover:bg-white">
                            {taskTypeText(task.type)}
                          </Badge>
                          <p className="font-bold">{task.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                        </div>
                      ))}
                    </div>

                    {day.checkpoints.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
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
          )}
        </section>

        <aside className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-700" />
                已保存目标
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingGoals ? (
                <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-500">加载中...</div>
              ) : goals.length ? (
                goals.map((goal) => (
                  <div key={goal.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="font-black">{goal.title}</h3>
                      <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                        {levelLabel(goal.cognitive_level)}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                      {goal.description || "暂无说明"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>截止：{formatDate(goal.deadline)}</span>
                      <span>进度：{goal.progress || 0}%</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/feynman?goalId=${goal.id}`}>复述验证</Link>
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href="/review">主动回忆</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <Plus className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                  <p className="font-bold">还没有保存目标</p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    创建目标后，它会成为笔记、复述和掌握度评估的起点。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="font-black">演示建议</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                答辩时可以先保存一个目标，再进入费曼复述。这样能清楚展示系统如何从“目标设定”进入“深度理解验证”。
              </p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
