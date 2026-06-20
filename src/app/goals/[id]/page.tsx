"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  MessageCircleQuestion,
  Network,
  NotebookPen,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type GoalRow = {
  id: string;
  title: string;
  description?: string | null;
  cognitive_level: string;
  status: string;
  deadline?: string | null;
  knowledge_points?: string[];
  daily_plan?: Array<{
    day: number;
    focus: string;
    objective: string;
    tasks?: Array<{ title: string; description?: string; type?: string; minutes?: number }>;
    checkpoints?: string[];
  }>;
  progress?: number;
  updated_at?: string;
};

type NoteRow = {
  id: string;
  title: string;
  summary?: string | null;
  subject?: string | null;
  tags?: string[] | null;
  key_points?: Array<string | { point?: string }>;
  status: string;
  updated_at?: string | null;
  created_at?: string | null;
};

type ConceptRow = {
  name: string;
  description?: string;
  noteCount?: number;
  learningState?: "weak" | "strong" | "unknown";
  masteryScore?: number | null;
};

const loopEntries = [
  {
    title: "知识摄入",
    action: "做笔记",
    description: "上传、粘贴、网页导入或自己写。",
    href: "/upload",
    icon: Upload,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    title: "深度理解",
    action: "费曼复述",
    description: "用自己的话解释概念，按知识库评分。",
    href: "/feynman",
    icon: MessageCircleQuestion,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    title: "主动回忆",
    action: "测验与闪卡",
    description: "用测验和间隔复习主动检索。",
    href: "/review",
    icon: BookOpenCheck,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "弱点补强",
    action: "专项补弱",
    description: "回到薄弱概念、相关笔记和练习。",
    href: "/concepts",
    icon: Network,
    tone: "bg-rose-50 text-rose-700",
  },
];

function levelLabel(level: string) {
  const map: Record<string, string> = {
    remember: "了解",
    understand: "理解",
    apply: "应用",
    analyze: "分析",
  };
  return map[level] || level;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: "进行中",
    completed: "已完成",
    paused: "已暂停",
    archived: "已归档",
  };
  return map[status] || status;
}

function normalize(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function keyPointText(item: string | { point?: string }) {
  return typeof item === "string" ? item : item.point || "";
}

function noteMatchesGoal(note: NoteRow, goal: GoalRow) {
  const text = normalize([
    note.title,
    note.summary,
    note.subject,
    note.tags?.join(" "),
    note.key_points?.map(keyPointText).join(" "),
  ].filter(Boolean).join(" "));
  const terms = [goal.title, ...(goal.knowledge_points || [])]
    .map((item) => normalize(item))
    .filter((item) => item.length >= 2);

  return terms.some((term) => text.includes(term) || term.includes(normalize(note.subject)));
}

function formatDate(value?: string | null) {
  if (!value) return "未设置";
  return new Date(value).toLocaleDateString("zh-CN");
}

function conceptStateText(state?: ConceptRow["learningState"]) {
  if (state === "weak") return "薄弱";
  if (state === "strong") return "较稳";
  return "待验证";
}

function conceptStateClass(state?: ConceptRow["learningState"]) {
  if (state === "weak") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  if (state === "strong") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

export default function GoalSpacePage() {
  const params = useParams<{ id: string }>();
  const goalId = params.id;
  const [goal, setGoal] = useState<GoalRow | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [goalsResponse, notesResponse, conceptsResponse] = await Promise.all([
          fetch("/api/learning-goals"),
          fetch("/api/notes?limit=100"),
          fetch("/api/concepts"),
        ]);
        const [goalsData, notesData, conceptsData] = await Promise.all([
          goalsResponse.json(),
          notesResponse.json(),
          conceptsResponse.json(),
        ]);

        if (!goalsResponse.ok) throw new Error(goalsData.error || "获取学习目标失败");
        if (!notesResponse.ok) throw new Error(notesData.error || "获取笔记失败");

        const currentGoal = (goalsData.goals || []).find((item: GoalRow) => item.id === goalId);
        if (!currentGoal) {
          setError("没有找到这个学习空间，可能已被删除或归档。");
          return;
        }

        setGoal(currentGoal);
        setNotes(notesData.notes || []);
        if (!conceptsData.error) setConcepts(conceptsData.concepts || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "加载学习空间失败");
      } finally {
        setLoading(false);
      }
    }

    if (goalId) void load();
  }, [goalId]);

  const relatedNotes = useMemo(() => {
    if (!goal) return [];
    return notes.filter((note) => noteMatchesGoal(note, goal)).slice(0, 8);
  }, [goal, notes]);

  const relatedConcepts = useMemo(() => {
    if (!goal) return [];
    const goalConcepts = new Set((goal.knowledge_points || []).filter(Boolean));
    const matchedFromConceptApi = concepts.filter((concept) => {
      const name = normalize(concept.name);
      return [...goalConcepts].some((point) => {
        const normalizedPoint = normalize(point);
        return name.includes(normalizedPoint) || normalizedPoint.includes(name);
      });
    });

    for (const note of relatedNotes) {
      for (const point of note.key_points || []) {
        const text = keyPointText(point).trim();
        if (text) goalConcepts.add(text);
      }
    }

    const merged: ConceptRow[] = [
      ...[...goalConcepts].map((name) => ({
        name,
        noteCount: relatedNotes.length,
        learningState: "unknown" as const,
        masteryScore: null,
      })),
      ...matchedFromConceptApi,
    ];
    const seen = new Set<string>();
    return merged.filter((concept) => {
      const key = normalize(concept.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);
  }, [concepts, goal, relatedNotes]);

  const mastery = Math.round(goal?.progress || 0);
  const nextConcept = relatedConcepts[0]?.name || goal?.knowledge_points?.[0] || goal?.title || "";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BackButton variant="ghost" size="icon">
<ArrowLeft className="h-5 w-5" />
              </BackButton>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black">{goal?.title || "学习空间"}</h1>
              <p className="hidden text-xs text-slate-500 sm:block">目标设定完成后，在这里推进四个学习动作</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="hidden border-slate-200 bg-white md:inline-flex" asChild>
              <Link href="/goals">管理目标</Link>
            </Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" asChild>
              <Link href={`/feynman?goalId=${goalId}`}>
                开始复述
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-4 md:px-6">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
            <Skeleton className="h-[calc(100vh-7rem)] rounded-lg" />
            <Skeleton className="h-[calc(100vh-7rem)] rounded-lg" />
            <Skeleton className="h-[calc(100vh-7rem)] rounded-lg" />
          </div>
        ) : error || !goal ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="font-bold text-red-600">{error || "学习空间加载失败"}</p>
              <BackButton className="mt-4">返回</BackButton>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:h-[calc(100vh-7rem)] lg:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="space-y-4 lg:min-h-0">
              <Card className="border-slate-200 bg-white shadow-sm lg:h-full">
                <CardContent className="flex h-full flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                      {levelLabel(goal.cognitive_level)}
                    </Badge>
                    <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                      {statusLabel(goal.status)}
                    </Badge>
                  </div>

                  <h2 className="mt-4 line-clamp-2 text-2xl font-black leading-tight">{goal.title}</h2>
                  <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">
                    {goal.description || "这个目标还没有详细说明。可以先补充知识点，再围绕它导入笔记、复述概念和生成测验。"}
                  </p>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>目标进度</span>
                      <span>{mastery}%</span>
                    </div>
                    <Progress value={mastery} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MetricCard label="概念" value={relatedConcepts.length} />
                    <MetricCard label="笔记" value={relatedNotes.length} />
                    <MetricCard label="计划" value={`${goal.daily_plan?.length || 0}天`} />
                    <MetricCard label="截止" value={formatDate(goal.deadline)} compact />
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-slate-600" />
                      <p className="text-sm font-black">学习记录</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-slate-500">笔记沉淀</p>
                        <p className="font-black">{relatedNotes.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">概念覆盖</p>
                        <p className="font-black">{relatedConcepts.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 min-h-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-black">学习计划</p>
                    {goal.daily_plan?.length ? (
                      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                        {goal.daily_plan.slice(0, 8).map((day) => (
                          <div key={day.day} className="rounded-lg bg-slate-50 p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge className="bg-slate-950 text-white hover:bg-slate-950">Day {day.day}</Badge>
                              <p className="line-clamp-1 text-sm font-bold">{day.focus}</p>
                            </div>
                            <p className="line-clamp-2 text-xs leading-5 text-slate-500">{day.objective}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-slate-500">还没有学习计划，可以回到目标页生成路径。</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </aside>

            <section className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
              <div className="grid gap-3 md:grid-cols-4">
                {loopEntries.map((entry) => {
                  const Icon = entry.icon;
                  const href = entry.href === "/feynman" ? `/feynman?goalId=${goal.id}` : entry.href;
                  return (
                    <Link
                      key={entry.title}
                      href={href}
                      className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`grid h-9 w-9 place-items-center rounded-lg ${entry.tone}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">{entry.title}</p>
                      <h3 className="mt-1 font-black">{entry.action}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{entry.description}</p>
                    </Link>
                  );
                })}
              </div>

              <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card className="min-h-0 border-slate-200 bg-white shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Network className="h-5 w-5" />
                      相关概念
                    </CardTitle>
                    <Button variant="outline" size="sm" className="h-8 border-slate-200 bg-white" asChild>
                      <Link href={`/feynman?goalId=${goal.id}`}>复述验证</Link>
                    </Button>
                  </CardHeader>
                  <CardContent className="min-h-0 p-4 pt-0">
                    {relatedConcepts.length ? (
                      <div className="grid max-h-[calc(100vh-24rem)] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:max-h-[calc(100vh-19rem)]">
                        {relatedConcepts.map((concept) => (
                          <Link
                            key={concept.name}
                            href={`/concepts/${encodeURIComponent(concept.name)}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:bg-white"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Badge className={conceptStateClass(concept.learningState)}>
                                {conceptStateText(concept.learningState)}
                              </Badge>
                              {concept.masteryScore != null && (
                                <span className="text-xs font-bold text-slate-400">
                                  {Math.round(concept.masteryScore * 100)}%
                                </span>
                              )}
                            </div>
                            <h3 className="line-clamp-1 font-black">{concept.name}</h3>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                              {concept.description || "可用于费曼复述、生成测验或专项补弱。"}
                            </p>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <CompactEmpty icon={Target} title="还没有概念" text="补充知识点或导入材料后，这里会显示可验证的概念。" />
                    )}
                  </CardContent>
                </Card>

                <Card className="min-h-0 border-slate-200 bg-white shadow-sm">
                  <CardHeader className="p-4 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BookOpenCheck className="h-5 w-5 text-emerald-700" />
                      测验与闪卡
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-0">
                    <div className="rounded-lg bg-emerald-50 p-3">
                      <p className="text-sm font-black">测验</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        从当前空间的相关笔记生成题目，验证概念掌握情况。
                      </p>
                      <div className="mt-3 space-y-2">
                        {relatedNotes.length ? (
                          relatedNotes.slice(0, 3).map((note) => (
                            <Button key={note.id} variant="outline" className="h-9 w-full justify-start border-white bg-white text-xs" asChild>
                              <Link href={`/quiz/${note.id}`}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span className="truncate">{note.title}</span>
                              </Link>
                            </Button>
                          ))
                        ) : (
                          <p className="text-xs leading-5 text-slate-500">还没有可生成测验的笔记。</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-cyan-50 p-3">
                      <p className="text-sm font-black">复习闪卡</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        复习队列会优先围绕这些相关概念补强。
                      </p>
                      <div className="mt-3 flex max-h-20 flex-wrap gap-2 overflow-y-auto">
                        {relatedConcepts.length ? (
                          relatedConcepts.slice(0, 8).map((concept) => (
                            <Badge key={concept.name} className="bg-white text-cyan-700 hover:bg-white">
                              {concept.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">暂无概念</span>
                        )}
                      </div>
                      <Button className="mt-3 h-9 w-full bg-slate-950 text-white hover:bg-slate-800" asChild>
                        <Link href="/review">进入复习队列</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <aside className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]">
              <Card className="border-slate-200 bg-slate-950 text-white shadow-sm">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-5 w-5 text-amber-300" />
                    下一步
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                  <div className="rounded-lg bg-white/10 p-3">
                    <p className="text-xs text-white/60">推荐动作</p>
                    <p className="mt-2 line-clamp-2 text-lg font-black">
                      {relatedNotes.length ? `复述「${nextConcept}」` : "先补充一篇相关笔记"}
                    </p>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/65">
                      {relatedNotes.length
                        ? "系统会优先参考这个空间里的笔记和知识点来评分。"
                        : "目标空间需要有材料，后续复述和测验才有参考依据。"}
                    </p>
                  </div>
                  <Button className="w-full bg-white text-slate-950 hover:bg-slate-100" asChild>
                    <Link href={relatedNotes.length ? `/feynman?goalId=${goal.id}` : "/upload"}>
                      {relatedNotes.length ? "进入费曼复述" : "导入学习材料"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="min-h-0 border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-5 w-5" />
                    相关笔记
                  </CardTitle>
                  <Button variant="outline" size="sm" className="h-8 border-slate-200 bg-white" asChild>
                    <Link href="/notes/new">
                      <NotebookPen className="mr-2 h-4 w-4" />
                      写
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="min-h-0 p-4 pt-0">
                  {relatedNotes.length ? (
                    <div className="max-h-[calc(100vh-25rem)] space-y-3 overflow-y-auto pr-1 lg:max-h-full">
                      {relatedNotes.map((note) => (
                        <Link
                          key={note.id}
                          href={`/notes/${note.id}`}
                          className="block rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:bg-white"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {note.subject && (
                              <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{note.subject}</Badge>
                            )}
                            <span className="text-xs text-slate-400">{formatDate(note.updated_at || note.created_at)}</span>
                          </div>
                          <h3 className="line-clamp-1 font-black">{note.title}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                            {note.summary || "这篇笔记可作为复述评分和测验生成的参考材料。"}
                          </p>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <CompactEmpty icon={FileText} title="暂无相关笔记" text="标题、摘要、标签或关键点命中目标知识点后会出现在这里。" />
                  )}
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 truncate font-black ${compact ? "text-sm" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function CompactEmpty({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Target;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
      <p className="font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}
