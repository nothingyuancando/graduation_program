"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Folder,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  status: string;
  total_files: number;
  processed_files: number;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const statusText: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  failed: "失败",
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await fetch("/api/upload/sessions");
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Link>
            </Button>
            <h1 className="text-xl font-semibold">上传会话</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">会话列表</h2>
            <p className="text-muted-foreground">
              共 {sessions.length} 个上传会话
            </p>
          </div>
          <Button asChild>
            <Link href="/">
              <Plus className="w-4 h-4 mr-2" />
              新建上传
            </Link>
          </Button>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Folder className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无会话</h3>
              <p className="text-muted-foreground mb-4">
                开始上传文件，创建你的第一个笔记会话
              </p>
              <Button asChild>
                <Link href="/">开始上传</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Link key={session.id} href={`/upload/sessions/${session.id}`}>
                <Card className="hover:border-blue-500 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {session.title}
                        </CardTitle>
                        <CardDescription>
                          {new Date(session.created_at).toLocaleString("zh-CN")}
                        </CardDescription>
                      </div>
                      <Badge
                        className={statusColors[session.status] || statusColors.pending}
                      >
                        {statusText[session.status] || session.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{session.total_files} 个文件</span>
                      </div>
                      {session.status === "completed" && (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>已完成</span>
                        </div>
                      )}
                      {session.status === "processing" && (
                        <div className="flex items-center gap-1 text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>处理中</span>
                        </div>
                      )}
                      {session.status === "failed" && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="w-4 h-4" />
                          <span>有错误</span>
                        </div>
                      )}
                    </div>
                    {session.total_files > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>处理进度</span>
                          <span>{session.processed_files} / {session.total_files}</span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all duration-300"
                            style={{
                              width: `${(session.processed_files / session.total_files) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
