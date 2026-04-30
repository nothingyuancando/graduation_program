"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, RotateCcw, FileText } from "lucide-react";

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

function daysLeft(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const now = Date.now();
  const elapsed = (now - deleted) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(7 - elapsed));
}

export default function TrashPage() {
  const [notes, setNotes] = useState<TrashedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchTrash();
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await fetch("/api/trash");
      const data = await res.json();
      if (data.notes) setNotes(data.notes);
    } catch (error) {
      console.error("Error fetching trash:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setActionLoading(id + "-restore");
    try {
      await fetch(`/api/trash/${id}/restore`, { method: "POST" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("确定永久删除？此操作不可撤销。")) return;
    setActionLoading(id + "-delete");
    try {
      await fetch(`/api/trash/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              回收站
            </h1>
            <p className="text-xs text-muted-foreground">笔记将在删除 7 天后自动清除</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">加载中...</div>
        ) : notes.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center">
              <Trash2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">回收站是空的</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const remaining = daysLeft(note.deleted_at);
              return (
                <Card key={note.id} className="border-dashed">
                  <CardContent className="p-4 flex items-start gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-muted-foreground">{note.title}</h3>
                      {note.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{note.summary}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-muted-foreground">
                          删除于 {new Date(note.deleted_at).toLocaleDateString("zh-CN")}
                        </span>
                        <Badge
                          variant="outline"
                          className={remaining <= 1 ? "text-red-500 border-red-300" : "text-orange-500 border-orange-300"}
                        >
                          {remaining} 天后永久删除
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(note.id)}
                        disabled={actionLoading === note.id + "-restore"}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        恢复
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handlePermanentDelete(note.id)}
                        disabled={actionLoading === note.id + "-delete"}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
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
