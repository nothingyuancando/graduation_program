"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type SessionFile = {
  id: string;
  original_file_name: string;
  file_size: number;
  file_type: string;
  category: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  extracted_text?: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
};

type Session = {
  id: string;
  title: string;
  status: string;
  total_files: number;
  processed_files: number;
  created_at: string;
  updated_at: string;
};

type SessionDetail = {
  session: Session;
  files: SessionFile[];
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
};

const fileStatusText: Record<string, string> = {
  pending: "等待解析",
  processing: "解析中",
  completed: "已解析",
  failed: "解析失败",
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileStatusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 hover:bg-emerald-50";
  if (status === "processing") return "bg-cyan-50 text-cyan-700 hover:bg-cyan-50";
  if (status === "failed") return "bg-rose-50 text-rose-700 hover:bg-rose-50";
  return "bg-slate-100 text-slate-700 hover:bg-slate-100";
}

function buildUserStage(stats: SessionDetail["stats"]) {
  const fileProgress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (stats.pending > 0 || stats.processing > 0) {
    return {
      title: "正在解析资料",
      description: `已解析 ${stats.completed}/${stats.total} 项，失败 ${stats.failed} 项。`,
      progress: fileProgress,
      activeIndex: 0,
    };
  }

  if (stats.completed > 0) {
    return {
      title: "准备生成学习笔记",
      description: "资料解析完成后，系统会直接调用大模型生成学习笔记。",
      progress: fileProgress,
      activeIndex: 1,
    };
  }

  return {
    title: "没有可整理的资料",
    description: "请返回上传页，重新导入可解析的文本、PDF、Markdown 或网页资料。",
    progress: fileProgress,
    activeIndex: 0,
  };
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoConsolidatedSessionRef = useRef<string | null>(null);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/upload/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error("没有找到这次导入记录。");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/upload/sessions/${sessionId}/process`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "解析资料失败");
      }
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析资料失败");
    } finally {
      setProcessing(false);
    }
  };

  const handleConsolidate = async () => {
    setConsolidating(true);
    try {
      const response = await fetch(`/api/upload/sessions/${sessionId}/consolidate`, {
        method: "POST",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error([result.error, result.hint, result.detail].filter(Boolean).join("\n") || "生成笔记失败");
      }
      if (result.note?.id) {
        router.push(`/notes/${result.note.id}`);
        return;
      }
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成笔记失败");
    } finally {
      setConsolidating(false);
    }
  };

  useEffect(() => {
    if (!data || processing || consolidating) return;

    const { session, stats } = data;

    if ((session.status === "pending" || session.status === "processing") && stats.pending > 0 && stats.processing === 0) {
      void handleProcess();
      return;
    }

    const allProcessed = stats.pending === 0 && stats.processing === 0 && stats.total > 0;
    const canAutoConsolidate =
      allProcessed &&
      stats.completed > 0 &&
      autoConsolidatedSessionRef.current !== session.id &&
      session.status !== "completed";

    if (canAutoConsolidate) {
      autoConsolidatedSessionRef.current = session.id;
      void handleConsolidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, processing, consolidating]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-700" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
        <Card className="w-full max-w-md border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="text-xl font-black">导入记录不可用</h2>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <Button className="mt-5" asChild>
              <Link href="/upload">重新导入</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { session, files, stats } = data;
  const userStage = buildUserStage(stats);
  const allProcessed = stats.pending === 0 && stats.processing === 0 && stats.total > 0;
  const canConsolidate = allProcessed && stats.completed > 0 && session.status !== "completed";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <BackButton variant="ghost" size="icon" fallbackHref="/upload">
              <ArrowLeft className="h-5 w-5" />
            </BackButton>
            <div>
              <h1 className="line-clamp-1 text-xl font-black">{session.title}</h1>
              <p className="text-sm text-slate-500">
                {new Date(session.created_at).toLocaleString("zh-CN")} 创建
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={fetchSession}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-700" />
                {userStage.title}
              </CardTitle>
              <CardDescription>{userStage.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Progress value={userStage.progress} />
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { title: "资料解析", description: "提取文本", done: stats.completed >= stats.total && stats.total > 0 },
                  { title: "AI 生成", description: "大模型生成学习笔记", done: session.status === "completed" },
                  { title: "进入学习", description: "复述与测验", done: session.status === "completed" },
                ].map((step, index) => {
                  const active = userStage.activeIndex === index;
                  return (
                    <div key={step.title} className={`rounded-lg border p-4 ${active ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="mb-2 flex items-center gap-2">
                        {step.done ? (
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-700" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-slate-300" />
                        )}
                        <p className="font-bold">{step.title}</p>
                      </div>
                      <p className="text-sm text-slate-500">{step.description}</p>
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {canConsolidate && (
                  <Button onClick={handleConsolidate} disabled={consolidating} className="bg-slate-950 text-white hover:bg-slate-800">
                    {consolidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    生成学习笔记
                  </Button>
                )}
                {stats.pending > 0 && (
                  <Button variant="outline" onClick={handleProcess} disabled={processing}>
                    {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    继续解析
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>资料列表</CardTitle>
              <CardDescription>
                共 {files.length} 项，已解析 {stats.completed} 项，失败 {stats.failed} 项。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{file.original_file_name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.file_size)}</p>
                      {file.error_message && <p className="mt-1 text-xs text-red-600">{file.error_message}</p>}
                    </div>
                    <Badge className={fileStatusClass(file.status)}>
                      {fileStatusText[file.status] || file.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>当前状态</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-950 p-4 text-white">
                <p className="text-xs text-white/60">总资料</p>
                <p className="mt-2 text-2xl font-black">{stats.total}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-xs text-emerald-700">已解析</p>
                <p className="mt-2 text-2xl font-black">{stats.completed}</p>
              </div>
              <div className="rounded-lg bg-cyan-50 p-4">
                <p className="text-xs text-cyan-700">处理中</p>
                <p className="mt-2 text-2xl font-black">{stats.processing + stats.pending}</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-4">
                <p className="text-xs text-rose-700">失败</p>
                <p className="mt-2 text-2xl font-black">{stats.failed}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-amber-50 shadow-sm">
            <CardContent className="p-5">
              <p className="font-black text-amber-900">说明</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                上传完成只代表资料进入解析流程。解析完成后，系统会直接调用大模型生成学习笔记，生成时间会随材料数量和内容长度变化。
              </p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
