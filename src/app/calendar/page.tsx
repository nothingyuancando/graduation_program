"use client";

import { useState, useEffect } from "react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Flame,
  Clock,
  FileText,
  BookOpen,
  Brain,
  Loader2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CheckinData {
  id: string;
  date: string;
  study_minutes: number;
  notes_created: number;
  notes_reviewed: number;
  quizzes_taken: number;
  checkin_note?: string;
}

interface Stats {
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
  weeklyTrend: Array<{
    date: string;
    dayLabel: string;
    studyMinutes: number;
  }>;
}

export default function CalendarPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [checkins, setCheckins] = useState<CheckinData[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCheckins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/checkin/stats");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCheckins = async () => {
    try {
      const res = await fetch(`/api/checkin?month=${currentMonth}`);
      const data = await res.json();
      setCheckins(data.checkins || []);
    } catch (error) {
      console.error("Error fetching checkins:", error);
    }
  };

  const handleCheckin = async () => {
    setCheckinLoading(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          study_minutes: parseInt(studyMinutes) || 0,
          checkin_note: checkinNote,
        }),
      });
      if (res.ok) {
        setStudyMinutes("");
        setCheckinNote("");
        await Promise.all([fetchStats(), fetchCheckins()]);
      }
    } catch (error) {
      console.error("Error checking in:", error);
    } finally {
      setCheckinLoading(false);
    }
  };

  const navigateMonth = (dir: number) => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCurrentMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  };

  // 日历生成
  const renderCalendar = () => {
    const [year, month] = currentMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startPad = (firstDay.getDay() + 6) % 7; // 周一开始
    const totalDays = lastDay.getDate();

    const checkinMap = new Map<string, CheckinData>();
    checkins.forEach((c) => checkinMap.set(c.date, c));

    const today = new Date().toISOString().split("T")[0];
    const cells = [];

    // 空白填充
    for (let i = 0; i < startPad; i++) {
      cells.push(<div key={`pad-${i}`} className="h-12" />);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const checkin = checkinMap.get(dateStr);
      const isToday = dateStr === today;
      const isSelected = dateStr === selectedDate;

      // 活动等级颜色
      let dotColor = "";
      if (checkin) {
        const activity =
          (checkin.notes_created || 0) +
          (checkin.notes_reviewed || 0) +
          (checkin.quizzes_taken || 0);
        if (activity >= 10 || checkin.study_minutes >= 120) dotColor = "bg-green-500";
        else if (activity >= 5 || checkin.study_minutes >= 60) dotColor = "bg-green-400";
        else if (activity >= 1 || checkin.study_minutes > 0) dotColor = "bg-green-300";
      }

      cells.push(
        <div
          key={dateStr}
          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
          className={`h-12 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors
            ${isToday ? "ring-2 ring-blue-500" : ""}
            ${isSelected ? "bg-blue-100 dark:bg-blue-900/30" : "hover:bg-slate-100 dark:hover:bg-slate-800"}
          `}
        >
          <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>
            {day}
          </span>
          {dotColor && (
            <div className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-0.5`} />
          )}
        </div>
      );
    }

    return cells;
  };

  // 热力图
  const renderHeatmap = () => {
    if (!stats?.heatmapData) return null;

    const heatmapMap = new Map(stats.heatmapData.map((d) => [d.date, d]));
    const cells = [];
    const now = new Date();

    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const data = heatmapMap.get(dateStr);
      const level = data?.level || 0;

      const colors = [
        "bg-slate-100 dark:bg-slate-800",
        "bg-green-200 dark:bg-green-900",
        "bg-green-300 dark:bg-green-700",
        "bg-green-500 dark:bg-green-500",
        "bg-green-700 dark:bg-green-400",
      ];

      cells.push(
        <div
          key={dateStr}
          className={`w-3 h-3 rounded-sm ${colors[level]}`}
          title={`${dateStr}: ${data ? `学习${data.studyMinutes}分钟` : "无记录"}`}
        />
      );
    }

    return cells;
  };

  const selectedCheckin = selectedDate
    ? checkins.find((c) => c.date === selectedDate)
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <BackButton variant="ghost" size="sm">
<ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </BackButton>
            <h1 className="text-2xl font-bold">学习日历</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">连续打卡</p>
                <p className="text-2xl font-bold">{stats?.streak || 0} <span className="text-sm font-normal">天</span></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">本周学习</p>
                <p className="text-2xl font-bold">{stats?.weekStudyMinutes || 0} <span className="text-sm font-normal">分钟</span></p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <FileText className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">本月笔记</p>
                <p className="text-2xl font-bold">{stats?.monthStats?.notesCreated || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Brain className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">本月测验</p>
                <p className="text-2xl font-bold">{stats?.monthStats?.quizzesTaken || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 日历视图 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>日历</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {currentMonth.replace("-", "年")}月
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* 星期头 */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                  <div key={d} className="h-8 flex items-center justify-center text-xs text-muted-foreground font-medium">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {renderCalendar()}
              </div>

              {/* 选中日期详情 */}
              {selectedDate && (
                <div className="mt-4 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <h4 className="font-medium mb-2">{selectedDate}</h4>
                  {selectedCheckin ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>学习时长：<span className="font-medium">{selectedCheckin.study_minutes} 分钟</span></div>
                      <div>创建笔记：<span className="font-medium">{selectedCheckin.notes_created} 篇</span></div>
                      <div>复习次数：<span className="font-medium">{selectedCheckin.notes_reviewed} 次</span></div>
                      <div>完成测验：<span className="font-medium">{selectedCheckin.quizzes_taken} 次</span></div>
                      {selectedCheckin.checkin_note && (
                        <div className="col-span-2 mt-1">
                          <span className="text-muted-foreground">打卡感想：</span>
                          <p className="mt-1">{selectedCheckin.checkin_note}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">当日无打卡记录</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 打卡面板 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  今日打卡
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">学习时长（分钟）</label>
                  <Input
                    type="number"
                    placeholder="30"
                    value={studyMinutes}
                    onChange={(e) => setStudyMinutes(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">打卡感想</label>
                  <Textarea
                    placeholder="今天学到了什么..."
                    value={checkinNote}
                    onChange={(e) => setCheckinNote(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  onClick={handleCheckin}
                  disabled={checkinLoading}
                  className="w-full"
                >
                  {checkinLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {checkinLoading ? "打卡中..." : "打卡"}
                </Button>
              </CardContent>
            </Card>

            {/* 活动统计 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">本月活动</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> 复习次数
                    </span>
                    <span className="font-medium">{stats?.monthStats?.notesReviewed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> 打卡天数
                    </span>
                    <span className="font-medium">{stats?.monthStats?.checkinDays || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 活动热力图 */}
        <Card>
          <CardHeader>
            <CardTitle>学习活动热力图（近 90 天）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {renderHeatmap()}
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>少</span>
              <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
              <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900" />
              <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-700" />
              <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-500" />
              <div className="w-3 h-3 rounded-sm bg-green-700 dark:bg-green-400" />
              <span>多</span>
            </div>
          </CardContent>
        </Card>

        {/* 周趋势图 */}
        {stats?.weeklyTrend && stats.weeklyTrend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>本周学习时长趋势</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dayLabel" />
                    <YAxis unit="min" />
                    <Tooltip
                      formatter={(value: number) => [`${value} 分钟`, "学习时长"]}
                      labelFormatter={(label: string) => `周${label}`}
                    />
                    <Bar dataKey="studyMinutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
