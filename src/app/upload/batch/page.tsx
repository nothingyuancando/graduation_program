"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Globe,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

type FileItem = {
  file: File;
  category: string;
};

function classifyFile(mimeType: string, fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md")
  ) {
    return "文档";
  }
  if (mimeType.startsWith("image/")) return "图片";
  if (mimeType.includes("presentation") || lowerName.endsWith(".ppt") || lowerName.endsWith(".pptx")) return "幻灯片";
  if (mimeType.includes("spreadsheet") || lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx") || lowerName.endsWith(".csv")) return "表格";
  return "其他";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BatchUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const nextFiles = selectedFiles.map((file) => ({
      file,
      category: classifyFile(file.type, file.name),
    }));
    setFiles((current) => [...current, ...nextFiles]);
    event.target.value = "";
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const addUrl = useCallback(() => {
    const value = urlInput.trim();
    if (!value || urls.includes(value)) return;
    setUrls((current) => [...current, value]);
    setUrlInput("");
  }, [urlInput, urls]);

  const removeUrl = useCallback((index: number) => {
    setUrls((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files]);
  const totalItems = files.length + urls.length;
  const groupedStats = useMemo(() => {
    return files.reduce<Record<string, number>>((stats, item) => {
      stats[item.category] = (stats[item.category] || 0) + 1;
      return stats;
    }, {});
  }, [files]);

  const handleUpload = async () => {
    if (totalItems === 0 || uploading) return;

    setUploading(true);
    setError("");
    setProgress(25);

    try {
      const formData = new FormData();
      formData.append("title", title.trim() || "资料导入");
      formData.append("urls", urls.join(","));
      files.forEach((item) => formData.append("files", item.file));

      setProgress(55);
      const response = await fetch("/api/upload/batch", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.error || "导入失败，请稍后重试。");
      }
      if (!data.session?.id) {
        throw new Error("没有获取到处理会话，请重新导入。");
      }

      setProgress(100);
      router.push(`/upload/sessions/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败，请稍后重试。");
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/upload">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-black">高级资料导入</h1>
              <p className="text-sm text-slate-500">一次导入多份材料，系统会解析内容并生成学习笔记。</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/upload">返回普通导入</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>这批资料叫什么？</CardTitle>
              <CardDescription>标题会作为后续生成笔记的默认主题。</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：数据库事务复习材料"
              />
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-cyan-700" />
                选择文件
              </CardTitle>
              <CardDescription>
                建议一次导入 3-8 个核心材料。资料越多，解析和 AI 生成时间越长。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <label
                htmlFor="file-upload"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-cyan-400 hover:bg-cyan-50/40"
              >
                <Upload className="mb-3 h-10 w-10 text-slate-400" />
                <p className="font-bold">点击选择文件</p>
                <p className="mt-2 text-sm text-slate-500">支持 PDF、Word、TXT、Markdown、图片、表格和 PPT</p>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif"
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">已选择 {files.length} 个文件</p>
                    <p className="text-sm text-slate-500">总大小 {formatFileSize(totalSize)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(groupedStats).map(([category, count]) => (
                      <Badge key={category} className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                        {category} {count}
                      </Badge>
                    ))}
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {files.map((item, index) => (
                      <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.file.name}</p>
                          <p className="text-xs text-slate-500">{item.category} · {formatFileSize(item.file.size)}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeFile(index)} aria-label="移除文件">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-700" />
                添加网页链接
              </CardTitle>
              <CardDescription>网页会作为一份学习材料进入同一个处理流程。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addUrl();
                    }
                  }}
                  placeholder="https://example.com/article"
                />
                <Button type="button" variant="outline" onClick={addUrl}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加
                </Button>
              </div>

              {urls.length > 0 && (
                <div className="space-y-2">
                  {urls.map((url, index) => (
                    <div key={url} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                      <Globe className="h-5 w-5 shrink-0 text-slate-500" />
                      <p className="min-w-0 flex-1 truncate text-sm">{url}</p>
                      <Button variant="ghost" size="icon" onClick={() => removeUrl(index)} aria-label="移除链接">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {uploading && (
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">正在创建导入会话</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} />
                <p className="text-sm text-slate-500">上传完成后会自动进入处理页，你可以在那里查看解析和 AI 生成进度。</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleUpload}
              disabled={totalItems === 0 || uploading}
              className="bg-slate-950 text-white hover:bg-slate-800"
              size="lg"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              导入 {totalItems} 项资料
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/upload">取消</Link>
            </Button>
          </div>
        </section>

        <aside className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>处理过程</CardTitle>
              <CardDescription>导入会按三个阶段推进，便于确认每份材料的状态。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                ["1", "上传资料", "保存文件和网页链接，创建处理会话。"],
                ["2", "解析内容", "逐批提取文本，失败文件会单独标记。"],
                ["3", "生成笔记", "AI 汇总材料，生成可继续复习的学习笔记。"],
              ].map(([step, titleText, description]) => (
                <div key={step} className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
                    {step}
                  </div>
                  <div>
                    <p className="font-bold">{titleText}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-amber-50 shadow-sm">
            <CardContent className="p-5">
              <p className="font-black text-amber-900">建议</p>
              <p className="mt-2 text-sm leading-6 text-amber-800">
                大批量材料会增加解析和 AI 生成时间。建议先导入最核心的资料，生成笔记后再继续补充。
              </p>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
