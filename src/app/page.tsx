"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Bot,
  CheckCircle2,
  Flame,
  GitFork,
  LogOut,
  MoreHorizontal,
  Send,
  Share2,
  Sparkles,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

type SpaceFilter = "active" | "completed";

type LearningSpace = {
  id: string;
  title: string;
  description: string;
  cognitiveLevel: string;
  status: string;
  stage: string;
  progress: number;
  masteryScore: number;
  conceptCount: number;
  noteCount: number;
  feynmanCount: number;
  concepts: string[];
  nextAction: {
    label: string;
    href: string;
    type: string;
  };
};

type DashboardAction = {
  title: string;
  description: string;
  href: string;
  priority: "high" | "medium" | "normal";
  type: "review" | "quiz" | "path" | "note";
};

type DashboardData = {
  overview: {
    totalNotes: number;
    dueReviewCount: number;
    weakConceptCount: number;
  };
  profile: {
    weakConcepts: Array<{ concept: string; score?: number; lastSeen?: string }>;
  };
  learningSpaces: LearningSpace[];
  recommendedActions: DashboardAction[];
};

type CheckinStats = {
  streak: number;
  heatmapData: Array<{
    date: string;
    level: number;
    studyMinutes: number;
    notesCreated: number;
    notesReviewed: number;
    quizzesTaken: number;
  }>;
};

function levelLabel(level: string) {
  const map: Record<string, string> = {
    remember: "了解",
    understand: "理解",
    apply: "应用",
    analyze: "分析",
  };
  return map[level] || level;
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function buildHeatmap(data: CheckinStats["heatmapData"]) {
  const map = new Map(data.map((item) => [item.date, item]));
  const today = new Date();

  return Array.from({ length: 70 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (69 - index));
    const dateText = toDateString(date);
    const item = map.get(dateText);

    return {
      date: dateText,
      level: item?.level || 0,
      studyMinutes: item?.studyMinutes || 0,
      notesCreated: item?.notesCreated || 0,
      notesReviewed: item?.notesReviewed || 0,
      quizzesTaken: item?.quizzesTaken || 0,
    };
  });
}

function heatColor(level: number) {
  switch (level) {
    case 1:
      return "bg-emerald-200";
    case 2:
      return "bg-emerald-400";
    case 3:
      return "bg-emerald-600";
    case 4:
      return "bg-slate-950";
    default:
      return "bg-slate-200";
  }
}

function EmptyLearningSpaces({ filter }: { filter: SpaceFilter }) {
  const isCompleted = filter === "completed";

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <Target className="mx-auto mb-4 h-10 w-10 text-slate-400" />
      <p className="font-bold">{isCompleted ? "还没有已完成的学习空间" : "还没有正在推进的学习空间"}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {isCompleted
          ? "完成一个目标后，它会留在这里，方便你回看整条学习闭环和沉淀下来的笔记。"
          : "先创建一个学习目标，系统会把它变成独立学习空间，再围绕知识摄入、深度理解、主动回忆和弱点补强持续推进。"}
      </p>
      {!isCompleted && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/goals">新建学习空间</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/explore">去闭环广场看看</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checkinStats, setCheckinStats] = useState<CheckinStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(true);
  const [filter, setFilter] = useState<SpaceFilter>("active");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const response = await fetch("/api/dashboard");
      const data = await response.json();
      if (!data.error) setDashboard(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadCheckinStats = useCallback(async () => {
    setCheckinLoading(true);
    try {
      const response = await fetch("/api/checkin/stats");
      const data = await response.json();
      if (!data.error) setCheckinStats(data);
    } catch (error) {
      console.error("Error loading checkin stats:", error);
    } finally {
      setCheckinLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    void loadCheckinStats();
  }, [loadCheckinStats, loadDashboard]);

  async function handlePublishSpace(event: Event, space: LearningSpace) {
    event.preventDefault();
    event.stopPropagation();

    setPublishingId(space.id);
    try {
      const response = await fetch(`/api/learning-goals/${space.id}/publish`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(data.error || "发布到广场失败");
        return;
      }
      const shouldOpen = window.confirm("已分享到学习闭环广场。要打开公开预览页吗？");
      if (shouldOpen && data.shareUrl) window.location.href = data.shareUrl;
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDeleteSpace(event: MouseEvent, space: LearningSpace) {
    event.preventDefault();
    event.stopPropagation();

    const confirmed = window.confirm(`确定把“${space.title}”移入回收站吗？相关笔记不会被删除。`);
    if (!confirmed) return;

    setDeletingId(space.id);
    try {
      const response = await fetch(`/api/learning-goals/${space.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        window.alert(data.error || "删除学习空间失败");
        return;
      }
      setDashboard((current) =>
        current
          ? {
              ...current,
              learningSpaces: current.learningSpaces.filter((item) => item.id !== space.id),
            }
          : current
      );
    } finally {
      setDeletingId(null);
    }
  }

  const spaces = dashboard?.learningSpaces || [];
  const activeSpaces = spaces.filter((space) => space.status !== "completed");
  const completedSpaces = spaces.filter((space) => space.status === "completed");
  const visibleSpaces = filter === "completed" ? completedSpaces : activeSpaces;
  const firstRecommendation = dashboard?.recommendedActions[0];
  const firstSpace = activeSpaces[0] || completedSpaces[0];
  const heatmap = useMemo(() => buildHeatmap(checkinStats?.heatmapData || []), [checkinStats]);
  const nextHref = firstSpace ? `/goals/${firstSpace.id}` : firstRecommendation?.href || "/goals";
  const nextTitle = firstSpace ? `继续推进“${firstSpace.title}”` : "从一个清晰目标开始";
  const nextDescription = firstSpace
    ? `当前来到“${firstSpace.stage}”阶段，下一步建议：${firstSpace.nextAction.label}。`
    : "把想学的内容放进一个学习空间，系统会帮你把材料、笔记、复述、测验和弱点补强串成一条闭环。";

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#fbfcf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#17231f] text-[#f6cf62]">
              <Brain className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight">AI 个性化学习笔记平台</h1>
              <p className="hidden text-xs text-slate-500 sm:block">每个学习空间，都是一条独立学习闭环</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-slate-200 bg-white" asChild>
              <Link href="/chat">
                <Bot className="mr-2 h-4 w-4" />
                AI 对话
              </Link>
            </Button>
            <Button className="hidden bg-[#17231f] text-white hover:bg-[#263a34] sm:inline-flex" asChild>
              <Link href={nextHref}>
                <Sparkles className="mr-2 h-4 w-4" />
                继续学习
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-lg">
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-36 truncate text-sm md:inline">{user?.email || "用户"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 md:px-8 md:py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <Badge className="mb-4 bg-[#f6cf62] text-slate-950 hover:bg-[#f6cf62]">学习空间</Badge>
            <h2 className="max-w-3xl text-3xl font-black leading-tight text-[#17231f] md:text-5xl">
              把每个目标，变成一条能持续推进的学习闭环。
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              首页只做一件事：帮你选择今天要推进的学习空间。进入空间后，再完成知识摄入、深度理解、主动回忆和弱点补强，让学习从“收集资料”走向“真正掌握”。
            </p>

            <div className="mt-7 rounded-lg border border-[#d7e5d6] bg-[#f1f7ee] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className="bg-white text-emerald-800 hover:bg-white">下一步</Badge>
                  </div>
                  <h3 className="text-xl font-black">{nextTitle}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{nextDescription}</p>
                </div>
                <Button className="h-11 shrink-0 bg-[#17231f] px-5 text-white hover:bg-[#263a34]" asChild>
                  <Link href={nextHref}>
                    进入
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <Card className="border-slate-200 bg-[#17231f] text-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-[#f6cf62]" />
                今日学习状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-16 rounded-lg bg-white/15" />
                  <Skeleton className="h-16 rounded-lg bg-white/15" />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-white/10 p-4">
                      <p className="text-xs text-white/60">进行中空间</p>
                      <p className="mt-2 text-2xl font-black">{activeSpaces.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-4">
                      <p className="text-xs text-white/60">已完成空间</p>
                      <p className="mt-2 text-2xl font-black">{completedSpaces.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-4">
                      <p className="text-xs text-white/60">薄弱点</p>
                      <p className="mt-2 text-2xl font-black">{dashboard?.overview.weakConceptCount || 0}</p>
                    </div>
                    <div className="rounded-lg bg-white/10 p-4">
                      <p className="text-xs text-white/60">连续学习</p>
                      <p className="mt-2 text-2xl font-black">
                        {checkinLoading ? "-" : checkinStats?.streak || 0} 天
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/10 p-3">
                    <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
                      {heatmap.map((cell) => (
                        <div
                          key={cell.date}
                          className={`h-3 w-3 shrink-0 rounded-[3px] ${heatColor(cell.level)}`}
                          title={`${cell.date}: 学习 ${cell.studyMinutes} 分钟，创建 ${cell.notesCreated} 篇，复习 ${cell.notesReviewed} 次，测验 ${cell.quizzesTaken} 次`}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  我的学习空间
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  每张卡片都是一个独立闭环。可以分享到广场给别人 Fork，也可以先移入回收站整理。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tabs value={filter} onValueChange={(value) => setFilter(value as SpaceFilter)}>
                  <TabsList className="h-10 rounded-lg bg-slate-100 p-1">
                    <TabsTrigger value="active" className="rounded-md px-3">
                      进行中 {activeSpaces.length}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="rounded-md px-3">
                      已完成 {completedSpaces.length}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button variant="outline" className="border-slate-200 bg-white" asChild>
                  <Link href="/trash">
                    <Trash2 className="mr-2 h-4 w-4" />
                    回收站
                  </Link>
                </Button>
                <Button className="bg-[#17231f] text-white hover:bg-[#263a34]" asChild>
                  <Link href="/goals">新建空间</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((item) => (
                    <Skeleton key={item} className="h-56 rounded-lg" />
                  ))}
                </div>
              ) : visibleSpaces.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {visibleSpaces.map((space) => (
                    <div
                      key={space.id}
                      className="group relative rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#17231f] text-white hover:bg-[#17231f]">{space.stage}</Badge>
                          <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">
                            {levelLabel(space.cognitiveLevel)}
                          </Badge>
                          {space.status === "completed" && (
                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">已完成</Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              disabled={publishingId === space.id}
                              onSelect={(event) => handlePublishSpace(event, space)}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              {publishingId === space.id ? "发布中..." : "分享到广场"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600"
                              disabled={deletingId === space.id}
                              onClick={(event) => handleDeleteSpace(event as unknown as MouseEvent, space)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              移入回收站
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <Link href={`/goals/${space.id}`} className="block">
                        <h3 className="line-clamp-1 text-lg font-black">{space.title}</h3>
                        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-slate-600">
                          {space.description ||
                            "这个学习空间还没有说明，可以先从知识点、笔记和复述验证开始完善。"}
                        </p>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>掌握度</span>
                            <span>{Math.round(space.masteryScore || space.progress || 0)}%</span>
                          </div>
                          <Progress value={Math.round(space.masteryScore || space.progress || 0)} />
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-lg font-black">{space.conceptCount}</p>
                            <p className="text-xs text-slate-500">概念</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-lg font-black">{space.noteCount}</p>
                            <p className="text-xs text-slate-500">笔记</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-lg font-black">{space.feynmanCount}</p>
                            <p className="text-xs text-slate-500">复述</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#fff4cf] px-3 py-2 text-sm">
                          <span className="line-clamp-1 font-bold text-slate-700">{space.nextAction.label}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5" />
                        </div>

                        {space.concepts.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {space.concepts.slice(0, 5).map((concept) => (
                              <span
                                key={concept}
                                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                              >
                                {concept}
                              </span>
                            ))}
                          </div>
                        )}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyLearningSpaces filter={filter} />
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-cyan-700" />
                  学习闭环广场
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  Fork 别人的公开学习闭环，系统会自动创建你的学习空间和核心笔记。你也可以从空间卡片菜单里把自己的闭环分享出去。
                </p>
                <Button className="mt-4 w-full bg-[#17231f] text-white hover:bg-[#263a34]" asChild>
                  <Link href="/explore">
                    <GitFork className="mr-2 h-4 w-4" />
                    去广场 Fork
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-600" />
                  优先补强
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {dashboardLoading ? (
                  <>
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-16 rounded-full" />
                  </>
                ) : dashboard?.profile.weakConcepts.length ? (
                  dashboard.profile.weakConcepts.slice(0, 10).map((item) => (
                    <Link key={item.concept} href={`/concepts/${encodeURIComponent(item.concept)}`}>
                      <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100">{item.concept}</Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    暂无薄弱点。完成测验、闪卡或费曼复述后，这里会自动更新。
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
