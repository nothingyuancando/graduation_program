"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  FileText,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  NotebookText,
  Search,
  Send,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  knowledge_points?: string[];
};

type KeyPoint = string | { point?: string; sourceQuote?: string; confidence?: number };

type NoteRow = {
  id: string;
  title: string;
  subject?: string | null;
  summary?: string | null;
  content?: string | null;
  tags?: string[] | null;
  key_points?: KeyPoint[] | null;
};

type ConceptOption = {
  name: string;
  source: "笔记知识点" | "目标知识点" | "标签" | "双链概念";
  detail?: string;
};

type FeynmanResult = {
  score: number;
  level: string;
  missingPoints: string[];
  misconceptions: string[];
  followUpQuestions: string[];
  recommendedReview: string[];
  aiFeedback: string;
};

function scoreClass(score: number) {
  if (score >= 85) return "bg-emerald-50 text-emerald-700";
  if (score >= 70) return "bg-cyan-50 text-cyan-700";
  if (score >= 50) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

function scoreText(score: number) {
  if (score >= 85) return "掌握较稳";
  if (score >= 70) return "基本理解";
  if (score >= 50) return "需要补强";
  return "理解薄弱";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function keyPointText(item: KeyPoint) {
  return typeof item === "string" ? item : String(item?.point || "");
}

function extractWikiLinks(content?: string | null) {
  if (!content) return [];
  return [...content.matchAll(/\[\[([^\]\n]+)\]\]/g)].map((match) => match[1].trim()).filter(Boolean);
}

function stripMarkdown(value?: string | null) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value: unknown, concept: string) {
  const text = normalize(String(value || ""));
  const key = normalize(concept);
  return Boolean(text && key && (text.includes(key) || key.includes(text)));
}

function conceptMatchesGoal(option: ConceptOption, goal?: GoalRow) {
  if (!goal?.knowledge_points?.length) return true;
  return goal.knowledge_points.some((point) => hasText(option.name, point) || hasText(point, option.name));
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!text) return {};
  if (contentType.includes("application/json")) {
    return JSON.parse(text) as Record<string, unknown>;
  }

  const preview = text.replace(/\s+/g, " ").slice(0, 180);
  throw new Error(
    response.redirected
      ? "接口请求被重定向了，请重新登录后再试。"
      : `接口返回的不是 JSON，HTTP ${response.status}。${preview}`
  );
}

export default function FeynmanPage() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [goalId, setGoalId] = useState("");
  const [noteId, setNoteId] = useState("");
  const [concept, setConcept] = useState("");
  const [conceptQuery, setConceptQuery] = useState("");
  const [userExplanation, setUserExplanation] = useState("");
  const [result, setResult] = useState<FeynmanResult | null>(null);
  const [masteryScore, setMasteryScore] = useState<number | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      const goalIdFromQuery = new URLSearchParams(window.location.search).get("goalId");
      if (goalIdFromQuery) setGoalId(goalIdFromQuery);

      setLoadingData(true);
      try {
        const [goalResponse, noteResponse] = await Promise.all([
          fetch("/api/learning-goals?status=active"),
          fetch("/api/notes?limit=80"),
        ]);
        const goalData = await readJsonResponse(goalResponse);
        const noteData = await readJsonResponse(noteResponse);
        if (!goalData.error) setGoals((goalData.goals as GoalRow[]) || []);
        if (!noteData.error) setNotes((noteData.notes as NoteRow[]) || []);
      } finally {
        setLoadingData(false);
      }
    }

    void loadData();
  }, []);

  const selectedGoal = useMemo(() => goals.find((goal) => goal.id === goalId), [goals, goalId]);
  const selectedNote = useMemo(() => notes.find((note) => note.id === noteId), [notes, noteId]);

  const conceptOptions = useMemo(() => {
    if (!selectedGoal || !selectedNote) return [];

    const map = new Map<string, ConceptOption>();
    const add = (name: string, source: ConceptOption["source"], detail?: string) => {
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 80) return;
      const key = normalize(cleanName);
      if (!map.has(key)) map.set(key, { name: cleanName, source, detail });
    };

    for (const point of selectedNote.key_points || []) {
      add(keyPointText(point), "笔记知识点", selectedNote.title);
    }
    for (const tag of selectedNote.tags || []) {
      add(tag, "标签", selectedNote.title);
    }
    for (const wikiLink of extractWikiLinks(selectedNote.content)) {
      add(wikiLink, "双链概念", selectedNote.title);
    }
    for (const point of selectedGoal.knowledge_points || []) {
      add(point, "目标知识点", selectedGoal.title);
    }

    const query = normalize(conceptQuery);
    const options = [...map.values()]
      .filter((item) => !query || normalize(item.name).includes(query))
      .sort((a, b) => {
        const sourceOrder = {
          笔记知识点: 0,
          目标知识点: 1,
          标签: 2,
          双链概念: 3,
        };
        const aGoalMatch = conceptMatchesGoal(a, selectedGoal) ? 0 : 1;
        const bGoalMatch = conceptMatchesGoal(b, selectedGoal) ? 0 : 1;
        return aGoalMatch - bGoalMatch || sourceOrder[a.source] - sourceOrder[b.source] || a.name.localeCompare(b.name);
      });

    return options.slice(0, 24);
  }, [conceptQuery, selectedGoal, selectedNote]);

  const selectedConceptOption = useMemo(
    () => conceptOptions.find((item) => normalize(item.name) === normalize(concept)),
    [concept, conceptOptions]
  );

  const handleGoalChange = (value: string) => {
    setGoalId(value);
    setConcept("");
    setConceptQuery("");
    setResult(null);
    setError("");
  };

  const handleNoteChange = (value: string) => {
    setNoteId(value);
    setConcept("");
    setConceptQuery("");
    setResult(null);
    setError("");
  };

  const chooseConcept = (item: ConceptOption) => {
    setConcept(item.name);
    setResult(null);
    setError("");
  };

  const evaluate = async () => {
    if (!goalId) {
      setError("请先选择关联学习目标。");
      return;
    }
    if (!noteId) {
      setError("请先选择优先参考笔记，模型会根据这篇笔记来评分。");
      return;
    }
    if (!concept.trim()) {
      setError("请先从这篇笔记的相关概念里选择一个要验证的概念。");
      return;
    }
    if (userExplanation.trim().length < 10) {
      setError("复述内容太短，请像给同学讲课一样解释完整。");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setMasteryScore(null);
    setUsedFallback(false);
    setFallbackReason("");

    try {
      const response = await fetch("/api/feynman/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.trim(),
          userExplanation,
          goalId,
          noteId,
        }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(data.error || "评估失败"));
      setResult(data.result as FeynmanResult);
      setMasteryScore(typeof data.masteryScore === "number" ? data.masteryScore : null);
      setUsedFallback(Boolean(data.usedFallback));
      setFallbackReason(String(data.fallbackReason || ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "评估失败");
    } finally {
      setLoading(false);
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
              <h1 className="text-xl font-black">费曼复述评估</h1>
              <p className="text-sm text-slate-500">先选目标和笔记，再复述笔记中的概念，由模型按知识库评分。</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/goals">目标与规划</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-700" />
                复述一个笔记概念
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="goal">关联学习目标</Label>
                  <select
                    id="goal"
                    value={goalId}
                    onChange={(event) => handleGoalChange(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    disabled={loadingData}
                  >
                    <option value="">先选择一个学习目标</option>
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="note">优先参考笔记</Label>
                  <select
                    id="note"
                    value={noteId}
                    onChange={(event) => handleNoteChange(event.target.value)}
                    className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    disabled={loadingData}
                  >
                    <option value="">再选择一篇参考笔记</option>
                    {notes.map((note) => (
                      <option key={note.id} value={note.id}>
                        {note.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <Label htmlFor="concept-search">这篇笔记相关的概念</Label>
                    <p className="mt-1 text-xs text-slate-500">
                      概念来自所选笔记的知识点、标签、双链概念，并补充当前目标的知识点。
                    </p>
                  </div>
                  <div className="relative md:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="concept-search"
                      value={conceptQuery}
                      onChange={(event) => setConceptQuery(event.target.value)}
                      placeholder="搜索当前笔记概念"
                      className="bg-white pl-9"
                      disabled={!selectedGoal || !selectedNote}
                    />
                  </div>
                </div>

                {!selectedGoal || !selectedNote ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    请先选择“关联学习目标”和“优先参考笔记”，系统会再列出这篇笔记可复述的概念。
                  </div>
                ) : conceptOptions.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {conceptOptions.map((item) => {
                      const active = normalize(item.name) === normalize(concept);
                      return (
                        <button
                          key={`${item.source}-${item.name}`}
                          type="button"
                          onClick={() => chooseConcept(item)}
                          className={`rounded-lg border p-3 text-left transition ${
                            active
                              ? "border-slate-950 bg-white shadow-sm"
                              : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="line-clamp-2 text-sm font-bold text-slate-900">{item.name}</span>
                            <Badge variant="outline" className="bg-white text-slate-500">
                              {item.source}
                            </Badge>
                          </div>
                          {item.detail && <p className="mt-2 line-clamp-1 text-xs text-slate-500">{item.detail}</p>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    这篇笔记还没有抽取出概念。可以先在笔记里补充关键点、标签或 [[双链概念]]，也可以在下方手动输入。
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="concept">要验证的概念</Label>
                <Input
                  id="concept"
                  value={concept}
                  onChange={(event) => setConcept(event.target.value)}
                  placeholder="从上方概念中选择，或手动输入一个概念"
                  className="mt-2"
                />
                {selectedConceptOption && (
                  <p className="mt-2 text-xs text-slate-500">
                    已选择当前笔记概念，模型会按“{selectedNote?.title}”和“{selectedGoal?.title}”进行验证评分。
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor="explanation">你的复述</Label>
                  <span className="text-xs text-slate-500">{userExplanation.length} 字符</span>
                </div>
                <Textarea
                  id="explanation"
                  value={userExplanation}
                  onChange={(event) => setUserExplanation(event.target.value)}
                  placeholder="不要照抄笔记。请像教一个同学一样解释：它是什么、为什么成立、怎么用、容易和什么混淆。"
                  rows={13}
                  className="resize-y leading-7"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                type="button"
                onClick={evaluate}
                disabled={loading}
                className="bg-slate-950 text-white hover:bg-slate-800"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                提交评估
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                    评估结果
                  </span>
                  <Badge className={scoreClass(result.score)}>
                    {result.score} 分 / {scoreText(result.score)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {usedFallback && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    模型暂时不可用，本次使用规则兜底评分。记录已保存，但建议模型恢复后再评一次。
                    {fallbackReason && (
                      <pre className="mt-2 whitespace-pre-wrap rounded-md bg-white/70 p-2 text-xs leading-5 text-amber-900">
                        {fallbackReason}
                      </pre>
                    )}
                  </div>
                )}

                <div className="rounded-lg bg-slate-950 p-5 text-white">
                  <p className="text-sm font-bold text-amber-300">理解水平</p>
                  <p className="mt-2 text-lg font-black">{result.level}</p>
                  <p className="mt-3 text-sm leading-6 text-white/75">{result.aiFeedback}</p>
                  {masteryScore != null && (
                    <p className="mt-3 text-sm text-white/60">概念综合掌握度已更新为 {masteryScore} 分。</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ResultList
                    icon={TriangleAlert}
                    title="遗漏点"
                    items={result.missingPoints}
                    emptyText="没有明显遗漏点。"
                    className="bg-amber-50 text-amber-800"
                  />
                  <ResultList
                    icon={TriangleAlert}
                    title="可能误解"
                    items={result.misconceptions}
                    emptyText="没有发现明显误解。"
                    className="bg-rose-50 text-rose-800"
                  />
                  <ResultList
                    icon={MessageCircleQuestion}
                    title="继续追问"
                    items={result.followUpQuestions}
                    emptyText="暂无追问。"
                    className="bg-violet-50 text-violet-800"
                  />
                  <ResultList
                    icon={Lightbulb}
                    title="建议复习"
                    items={result.recommendedReview}
                    emptyText="暂无复习建议。"
                    className="bg-cyan-50 text-cyan-800"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-700" />
                当前评分依据
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-slate-500" />
                  <p className="font-bold">学习目标</p>
                </div>
                <p className="text-sm leading-6 text-slate-600">{selectedGoal?.title || "未选择目标"}</p>
                {selectedGoal?.knowledge_points?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedGoal.knowledge_points.slice(0, 6).map((point) => (
                      <Badge key={point} variant="outline" className="bg-white">
                        {point}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <NotebookText className="h-4 w-4 text-slate-500" />
                  <p className="font-bold">参考笔记</p>
                </div>
                {selectedNote ? (
                  <div className="rounded-md bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">{selectedNote.title}</p>
                    <p className="mt-1 line-clamp-5 text-xs leading-5 text-slate-500">
                      {selectedNote.summary ||
                        stripMarkdown(selectedNote.content).slice(0, 220) ||
                        "这篇笔记会作为模型评分的主要知识库依据。"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-600">请选择一篇笔记，模型会用它来核对你的复述。</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-700" />
                复述提示
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <p>1. 先说这个概念是什么，不要直接背定义。</p>
              <p>2. 说明它为什么存在，解决什么问题。</p>
              <p>3. 举一个例子或应用场景。</p>
              <p>4. 讲清楚它和相近概念的区别。</p>
              <p>5. 最后说一个容易出错的地方。</p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function ResultList({
  icon: Icon,
  title,
  items,
  emptyText,
  className,
}: {
  icon: typeof TriangleAlert;
  title: string;
  items: string[];
  emptyText: string;
  className: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${className}`}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="font-black">{title}</p>
      </div>
      {items.length ? (
        <ul className="space-y-2 text-sm leading-6 text-slate-600">
          {items.map((item) => (
            <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">{emptyText}</p>
      )}
    </div>
  );
}
