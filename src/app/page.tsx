"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Flame,
  Library,
  LogOut,
  MessageCircle,
  Network,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Target,
  Upload,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";

type DashboardNote = {
  id: string;
  title: string;
  summary?: string;
  subject?: string;
  tags?: string[];
  status: string;
  updated_at: string;
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
    processedNotes: number;
    dueReviewCount: number;
    weakConceptCount: number;
    recentQuizCount: number;
    conceptCount: number;
  };
  profile: {
    weakConcepts: Array<{ concept: string; score?: number; lastSeen?: string }>;
    strongConcepts: Array<{ concept: string; score?: number; lastSeen?: string }>;
    interests: string[];
    studyStats: Record<string, unknown>;
  };
  recentNotes: DashboardNote[];
  notesWithoutQuiz: DashboardNote[];
  topConcepts: Array<{ name: string; count: number; types: string[] }>;
  recommendedActions: DashboardAction[];
};

type CheckinStats = {
  streak: number;
  weekStudyMinutes: number;
  monthStats: {
    notesCreated: number;
    notesReviewed: number;
    quizzesTaken: number;
    checkinDays: number;
  };
  heatmapData: Array<{
    date: string;
    level: number;
    studyMinutes: number;
    notesCreated: number;
    notesReviewed: number;
    quizzesTaken: number;
  }>;
};

const primaryActions = [
  {
    href: "/upload/batch",
    title: "导入资料",
    description: "PDF、Word、图片或网页，一次生成学习笔记",
    icon: Upload,
    className: "bg-slate-950 text-white hover:bg-slate-800",
  },
  {
    href: "/notes/new",
    title: "写一篇笔记",
    description: "使用模板和右侧实时预览整理知识点",
    icon: Plus,
    className: "bg-white text-slate-950 hover:bg-slate-50",
  },
  {
    href: "/review",
    title: "今日复习",
    description: "按到期卡片复习，自动更新掌握度",
    icon: BookOpen,
    className: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
];

const secondaryActions = [
  { href: "/notes", label: "笔记库", icon: Library },
  { href: "/explore", label: "广场", icon: Share2 },
  { href: "/concepts", label: "概念", icon: Network },
  { href: "/learning-path", label: "学习路径", icon: Target },
  { href: "/chat", label: "AI 助手", icon: MessageCircle },
  { href: "/settings/llm", label: "模型设置", icon: Settings },
];

function priorityLabel(priority: DashboardAction["priority"]) {
  if (priority === "high") return "优先";
  if (priority === "medium") return "建议";
  return "可选";
}

function priorityClass(priority: DashboardAction["priority"]) {
  if (priority === "high") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  if (priority === "medium") return "bg-amber-50 text-amber-700 hover:bg-amber-50";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "草稿";
    case "processed":
      return "已分析";
    case "organized":
      return "已整理";
    case "analyzing":
      return "分析中";
    default:
      return status;
  }
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function toDateString(date: Date) {
  return date.toISOString().split("T")[0];
}

function buildHeatmap(data: CheckinStats["heatmapData"]) {
  const map = new Map(data.map((item) => [item.date, item]));
  const today = new Date();

  return Array.from({ length: 91 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (90 - index));
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
      return "bg-slate-200/80";
  }
}

function StudyHeatmap({
  stats,
  cells,
  loading,
}: {
  stats: CheckinStats | null;
  cells: ReturnType<typeof buildHeatmap>;
  loading: boolean;
}) {
  return (
    <Card className="border-slate-950/10 bg-white/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-600" />
            学习热力图
          </span>
          <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50">
            {stats?.streak || 0} 天连续
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <>
            <div className="rounded-2xl border border-slate-950/10 bg-slate-50/80 p-3">
              <div className="grid grid-flow-col grid-rows-7 gap-1.5 overflow-x-auto pb-1">
                {cells.map((cell) => (
                  <div
                    key={cell.date}
                    className={`h-3 w-3 shrink-0 rounded-[4px] ${heatColor(cell.level)} transition hover:scale-125`}
                    title={`${cell.date}: 学习 ${cell.studyMinutes} 分钟，创建 ${cell.notesCreated} 篇，复习 ${cell.notesReviewed} 次，测验 ${cell.quizzesTaken} 次`}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-[#f7c76b]/25 p-3">
                <p className="text-xs text-slate-500">本周</p>
                <p className="mt-1 text-base font-black">{stats?.weekStudyMinutes || 0} min</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-slate-500">打卡</p>
                <p className="mt-1 text-base font-black">{stats?.monthStats?.checkinDays || 0} 天</p>
              </div>
              <div className="rounded-xl bg-sky-50 p-3">
                <p className="text-xs text-slate-500">测验</p>
                <p className="mt-1 text-base font-black">{stats?.monthStats?.quizzesTaken || 0}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checkinStats, setCheckinStats] = useState<CheckinStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dashboardResponse, checkinResponse] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/checkin/stats"),
        ]);
        const dashboardData = await dashboardResponse.json();
        const checkinData = await checkinResponse.json();
        if (!dashboardData.error) setDashboard(dashboardData);
        if (!checkinData.error) setCheckinStats(checkinData);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filteredNotes = useMemo(() => {
    const notes = dashboard?.recentNotes || [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return notes.slice(0, 6);

    return notes
      .filter((note) => {
        return (
          note.title.toLowerCase().includes(query) ||
          note.summary?.toLowerCase().includes(query) ||
          note.subject?.toLowerCase().includes(query) ||
          note.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
      })
      .slice(0, 8);
  }, [dashboard?.recentNotes, searchQuery]);

  const firstRecommendation = dashboard?.recommendedActions[0];
  const hasNotes = (dashboard?.overview.totalNotes || 0) > 0;
  const heatmap = useMemo(() => buildHeatmap(checkinStats?.heatmapData || []), [checkinStats]);

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-950/10 bg-[#fbf7ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-[#f7c76b]">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">AI 个性化学习知识库</h1>
              <p className="hidden text-xs text-slate-500 sm:block">导入资料，复习薄弱点，形成知识网络</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button className="hidden bg-slate-950 text-white hover:bg-slate-800 sm:inline-flex" asChild>
              <Link href="/upload/batch">
                <Upload className="mr-2 h-4 w-4" />
                导入
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 rounded-xl">
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

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6 md:px-8 md:py-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-slate-950/10 bg-white/80 p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <Badge className="mb-4 bg-[#f7c76b] text-slate-950 hover:bg-[#f7c76b]">
                  学习工作台
                </Badge>
                <h2 className="max-w-2xl text-3xl font-black leading-tight md:text-5xl">
                  今天从一个动作开始。
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                  不需要先想清楚功能在哪里。导入资料、写笔记或复习到期内容，系统会继续整理关键知识点、证据和相关概念。
                </p>
              </div>

              <Button className="h-12 shrink-0 bg-slate-950 px-5 text-white hover:bg-slate-800" asChild>
                <Link href={hasNotes ? "/review" : "/upload/batch"}>
                  {hasNotes ? "继续学习" : "开始导入"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-7 grid gap-3 md:grid-cols-3">
              {primaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`rounded-2xl border border-slate-950/10 p-5 shadow-sm transition hover:-translate-y-0.5 ${action.className}`}
                  >
                    <Icon className="mb-4 h-5 w-5" />
                    <h3 className="font-black">{action.title}</h3>
                    <p className="mt-2 text-sm leading-6 opacity-75">{action.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>

          <Card className="border-slate-950/10 bg-slate-950 text-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-5 w-5 text-[#f7c76b]" />
                下一步
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-20 rounded-2xl bg-white/15" />
                  <Skeleton className="h-20 rounded-2xl bg-white/15" />
                </>
              ) : firstRecommendation ? (
                <Link href={firstRecommendation.href} className="block rounded-2xl bg-white/10 p-4 transition hover:bg-white/15">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-bold">{firstRecommendation.title}</p>
                    <Badge className={priorityClass(firstRecommendation.priority)}>
                      {priorityLabel(firstRecommendation.priority)}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-white/70">{firstRecommendation.description}</p>
                </Link>
              ) : (
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="font-bold">先导入一份资料</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">
                    有内容之后，这里会自动出现复习、测验或学习路径建议。
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                {secondaryActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.href}
                      variant="secondary"
                      className="justify-start rounded-xl bg-white/10 text-white hover:bg-white/15"
                      asChild
                    >
                      <Link href={action.href}>
                        <Icon className="mr-2 h-4 w-4" />
                        {action.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="border-slate-950/10 bg-white/80 shadow-sm">
            <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  最近笔记
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500">先看到内容，再进入详情、测验或复习。</p>
              </div>
              <Button variant="outline" className="border-slate-950/10 bg-white" asChild>
                <Link href="/notes">全部笔记</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="搜索标题、摘要、学科或标签"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-11 rounded-xl border-slate-950/10 bg-white pl-11"
                />
              </div>

              {loading ? (
                [1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)
              ) : filteredNotes.length ? (
                <div className="divide-y divide-slate-950/10 rounded-2xl border border-slate-950/10 bg-white">
                  {filteredNotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="flex items-start justify-between gap-4 p-4 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {note.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{note.subject}</Badge>}
                          <Badge variant="outline">{statusLabel(note.status)}</Badge>
                          <span className="text-xs text-slate-400">{formatDate(note.updated_at)}</span>
                        </div>
                        <h3 className="line-clamp-1 font-black">{note.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                          {note.summary || "还没有摘要，进入笔记后可以继续分析和整理。"}
                        </p>
                      </div>
                      <ChevronRight className="mt-7 h-5 w-5 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-950/20 bg-white/70 px-6 py-12 text-center">
                  <FileText className="mx-auto mb-4 h-10 w-10 text-slate-400" />
                  <p className="font-bold">还没有笔记</p>
                  <p className="mt-2 text-sm text-slate-500">导入资料或新建笔记后，这里会出现最近内容。</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <StudyHeatmap stats={checkinStats} cells={heatmap} loading={loading} />

            <Card className="border-slate-950/10 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  当前状态
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950 p-4 text-white">
                  <p className="text-xs text-white/60">笔记</p>
                  <p className="mt-2 text-2xl font-black">{dashboard?.overview.totalNotes || 0}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-700">待复习</p>
                  <p className="mt-2 text-2xl font-black">{dashboard?.overview.dueReviewCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 p-4">
                  <p className="text-xs text-rose-700">薄弱点</p>
                  <p className="mt-2 text-2xl font-black">{dashboard?.overview.weakConceptCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-cyan-50 p-4">
                  <p className="text-xs text-cyan-700">概念</p>
                  <p className="mt-2 text-2xl font-black">{dashboard?.overview.conceptCount || 0}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-950/10 bg-white/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-rose-600" />
                  薄弱概念
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="h-7 w-16 rounded-full" />
                  </>
                ) : dashboard?.profile.weakConcepts.length ? (
                  dashboard.profile.weakConcepts.slice(0, 10).map((item) => (
                    <Link key={item.concept} href={`/concepts/${encodeURIComponent(item.concept)}`}>
                      <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100">
                        [[{item.concept}]]
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    暂无薄弱点。完成测验或复习评分后会自动更新。
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
