"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, FileText, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TrashKind = "note" | "learning_goal";

interface TrashedNote {
  id: string;
  title: string;
  summary?: string;
  tags?: string[];
  source_type: string;
  status: string;
  deleted_at: string;
  updated_at: string;
}

interface TrashedLearningGoal {
  id: string;
  title: string;
  description?: string;
  cognitive_level?: string;
  status: string;
  deleted_at: string;
  updated_at: string;
}

function daysLeft(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsed = (now - deleted) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(7 - elapsed));
}

export default function TrashPage() {
  const [notes, setNotes] = useState<TrashedNote[]>([]);
  const [learningGoals, setLearningGoals] = useState<TrashedLearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [view, setView] = useState<TrashKind>("learning_goal");

  useEffect(() => {
    void fetchTrash();
  }, []);

  const items = useMemo(() => (view === "learning_goal" ? learningGoals : notes), [learningGoals, notes, view]);

  async function fetchTrash() {
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
      if (data.learningGoals) setLearningGoals(data.learningGoals);
    } catch (error) {
      console.error("Error fetching trash:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(id: string, type: TrashKind) {
    setActionLoading(id + "-restore");
    try {
      await fetch(`/api/trash/${id}/restore?type=${type}`, { method: "POST" });
      if (type === "learning_goal") {
        setLearningGoals((prev) => prev.filter((item) => item.id !== id));
      } else {
        setNotes((prev) => prev.filter((item) => item.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePermanentDelete(id: string, type: TrashKind) {
    const label = type === "learning_goal" ? "学习空间" : "笔记";
    if (!window.confirm(`确定永久删除这个${label}吗？此操作不可撤销。`)) return;

    setActionLoading(id + "-delete");
    try {
      await fetch(`/api/trash/${id}?type=${type}`, { method: "DELETE" });
      if (type === "learning_goal") {
        setLearningGoals((prev) => prev.filter((item) => item.id !== id));
      } else {
        setNotes((prev) => prev.filter((item) => item.id !== id));
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-[#fbfcf8]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-4">
          <BackButton variant="ghost" size="sm">
<ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
              </BackButton>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black">
              <Trash2 className="h-5 w-5 text-slate-500" />
              回收站
            </h1>
            <p className="text-xs text-slate-500">学习空间可恢复；笔记会在删除 7 天后自动清理。</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={(value) => setView(value as TrashKind)}>
            <TabsList className="h-11 rounded-lg bg-white p-1 shadow-sm">
              <TabsTrigger value="learning_goal" className="rounded-md px-4">
                学习空间 {learningGoals.length}
              </TabsTrigger>
              <TabsTrigger value="note" className="rounded-md px-4">
                笔记 {notes.length}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" asChild>
            <Link href="/goals">新建学习空间</Link>
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500">加载中...</div>
        ) : items.length === 0 ? (
          <Card className="border-dashed bg-white">
            <CardContent className="py-20 text-center">
              <Trash2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="font-semibold text-slate-600">这里暂时是空的</p>
              <p className="mt-2 text-sm text-slate-500">
                {view === "learning_goal" ? "被删除的学习空间会出现在这里。" : "被删除的笔记会出现在这里。"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {view === "learning_goal"
              ? learningGoals.map((goal) => (
                  <Card key={goal.id} className="border-dashed bg-white">
                    <CardContent className="flex items-start gap-4 p-4">
                      <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold text-slate-700">{goal.title}</h3>
                        {goal.description && (
                          <p className="mt-1 line-clamp-1 text-sm text-slate-500">{goal.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">学习空间</Badge>
                          <span className="text-xs text-slate-500">
                            移入回收站：{new Date(goal.deleted_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore(goal.id, "learning_goal")}
                          disabled={actionLoading === goal.id + "-restore"}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          恢复
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handlePermanentDelete(goal.id, "learning_goal")}
                          disabled={actionLoading === goal.id + "-delete"}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          永久删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              : notes.map((note) => {
                  const remaining = daysLeft(note.deleted_at);
                  return (
                    <Card key={note.id} className="border-dashed bg-white">
                      <CardContent className="flex items-start gap-4 p-4">
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-semibold text-slate-700">{note.title}</h3>
                          {note.summary && (
                            <p className="mt-1 line-clamp-1 text-sm text-slate-500">{note.summary}</p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-slate-500">
                              删除于 {new Date(note.deleted_at).toLocaleDateString("zh-CN")}
                            </span>
                            <Badge
                              variant="outline"
                              className={
                                remaining <= 1
                                  ? "border-red-300 text-red-500"
                                  : "border-orange-300 text-orange-500"
                              }
                            >
                              {remaining} 天后永久删除
                            </Badge>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRestore(note.id, "note")}
                            disabled={actionLoading === note.id + "-restore"}
                          >
                            <RotateCcw className="mr-1 h-4 w-4" />
                            恢复
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handlePermanentDelete(note.id, "note")}
                            disabled={actionLoading === note.id + "-delete"}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            永久删除
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        )}
      </main>
    </div>
  );
}
