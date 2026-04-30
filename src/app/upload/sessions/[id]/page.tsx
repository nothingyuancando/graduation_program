"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  File,
  Play,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface SessionFile {
  id: string;
  original_file_name: string;
  file_size: number;
  file_type: string;
  category: string;
  status: string;
  extracted_text?: string;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface Session {
  id: string;
  title: string;
  status: string;
  total_files: number;
  processed_files: number;
  created_at: string;
  updated_at: string;
}

interface SessionDetail {
  session: Session;
  files: SessionFile[];
  stats: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

const categoryIcons: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  text: <FileText className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
  presentation: <File className="w-4 h-4" />,
  spreadsheet: <File className="w-4 h-4" />,
  audio: <File className="w-4 h-4" />,
  video: <File className="w-4 h-4" />,
  other: <File className="w-4 h-4" />,
};

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

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/upload/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error("会话不存在");
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
    fetchSession();
    // 每5秒刷新一次状态
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
        throw new Error("处理失败");
      }
      await fetchSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败");
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
      if (!response.ok) {
        throw new Error("合并失败");
      }
      const result = await response.json();
      // 跳转到笔记页面
      if (result.note?.id) {
        router.push(`/notes/${result.note.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "合并失败");
    } finally {
      setConsolidating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">会话不存在</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { session, files, stats } = data;
  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const allProcessed = stats.pending === 0 && stats.processing === 0 && stats.total > 0;
  const canConsolidate = allProcessed && stats.completed > 0 && session.status !== "completed";

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
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{session.title}</h1>
              <p className="text-sm text-muted-foreground">
                创建于 {new Date(session.created_at).toLocaleString("zh-CN")}
              </p>
            </div>
            <Badge
              className={statusColors[session.status] || statusColors.pending}
            >
              {statusText[session.status] || session.status}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：进度和操作 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 处理进度 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">处理进度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>已完成</span>
                    <span>{stats.completed} / {stats.total}</span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span>待处理: {stats.pending}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>处理中: {stats.processing}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>已完成: {stats.completed}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span>失败: {stats.failed}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 操作按钮 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {session.status === "pending" && (
                  <Button
                    className="w-full"
                    onClick={handleProcess}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        处理中...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        开始处理
                      </>
                    )}
                  </Button>
                )}

                {session.status === "processing" && (
                  <Button
                    className="w-full"
                    onClick={handleProcess}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        继续处理...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        继续处理剩余文件
                      </>
                    )}
                  </Button>
                )}

                {canConsolidate && (
                  <Button
                    className="w-full"
                    onClick={handleConsolidate}
                    disabled={consolidating}
                  >
                    {consolidating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        生成笔记中...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        生成笔记
                      </>
                    )}
                  </Button>
                )}

                {session.status === "completed" && (
                  <Button className="w-full" asChild>
                    <Link href={`/notes?sessionId=${session.id}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      查看笔记
                    </Link>
                  </Button>
                )}

                <Button variant="outline" className="w-full" onClick={fetchSession}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  刷新状态
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：文件列表 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">文件列表</CardTitle>
                <CardDescription>
                  共 {files.length} 个文件
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-shrink-0">
                        {categoryIcons[file.category] || categoryIcons.other}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {file.original_file_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.file_size)}
                        </p>
                      </div>
                      <Badge
                        className={statusColors[file.status] || statusColors.pending}
                      >
                        {statusText[file.status] || file.status}
                      </Badge>
                      {file.status === "completed" && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                      {file.status === "failed" && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
