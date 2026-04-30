"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LucideIcon,
  ArrowLeft,
  Upload,
  FileText,
  Image,
  Presentation,
  Table,
  Music,
  Video,
  Archive,
  Link as LinkIcon,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Play,
} from "lucide-react";

interface FileItem {
  file: File;
  category: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
}

const categoryIcons: Record<string, LucideIcon> = {
  text: FileText,
  image: Image,
  presentation: Presentation,
  spreadsheet: Table,
  audio: Music,
  video: Video,
  archive: Archive,
  other: FileText,
};

const categoryColors: Record<string, string> = {
  text: "text-blue-500",
  image: "text-green-500",
  presentation: "text-orange-500",
  spreadsheet: "text-emerald-500",
  audio: "text-purple-500",
  video: "text-pink-500",
  archive: "text-gray-500",
  other: "text-gray-500",
};

// 文件分类器
function classifyFile(mimeType: string, fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "text/html" ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".html")
  ) {
    return "text";
  }
  if (mimeType.startsWith("image/")) return "image";
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    fileName.endsWith(".ppt") ||
    fileName.endsWith(".pptx")
  ) {
    return "presentation";
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  ) {
    return "spreadsheet";
  }
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed")) {
    return "archive";
  }
  return "other";
}

export default function BatchUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0); // 1=上传 2=提取 3=生成
  const [stepError, setStepError] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: FileItem[] = selectedFiles.map((file) => ({
      file,
      category: classifyFile(file.type, file.name),
      status: "pending",
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddUrl = useCallback(() => {
    if (urlInput.trim() && !urls.includes(urlInput.trim())) {
      setUrls((prev) => [...prev, urlInput.trim()]);
      setUrlInput("");
    }
  }, [urlInput, urls]);

  const handleRemoveUrl = useCallback((index: number) => {
    setUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = async () => {
    if (files.length === 0 && urls.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    setCurrentStep(1);
    setStepError(null);

    try {
      const formData = new FormData();
      formData.append("title", title || "未整理笔记");
      formData.append("urls", urls.join(","));
      for (const fileItem of files) {
        formData.append("files", fileItem.file);
      }

      // 步骤 1：上传文件
      const uploadResponse = await fetch("/api/upload/batch", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const err = await uploadResponse.json();
        throw new Error(err.detail || err.error || "上传失败");
      }

      const uploadData = await uploadResponse.json();
      if (!uploadData.session) throw new Error("未获取到上传会话");

      setUploadProgress(33);
      setCurrentStep(2);

      // 步骤 2：提取文本
      const processResponse = await fetch(
        `/api/upload/sessions/${uploadData.session.id}/process`,
        { method: "POST" }
      );

      if (!processResponse.ok) {
        const err = await processResponse.json();
        throw new Error(err.error || "文本提取失败");
      }

      setUploadProgress(66);
      setCurrentStep(3);

      // 步骤 3：AI 生成笔记
      const consolidateResponse = await fetch(
        `/api/upload/sessions/${uploadData.session.id}/consolidate`,
        { method: "POST" }
      );

      if (!consolidateResponse.ok) {
        const err = await consolidateResponse.json();
        throw new Error(err.error || "笔记生成失败");
      }

      const consolidateData = await consolidateResponse.json();
      setUploadProgress(100);

      if (consolidateData.note) {
        router.push(`/notes/${consolidateData.note.id}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "未知错误";
      setStepError(msg);
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const fileStats = files.reduce(
    (acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">批量上传</h1>
              <p className="text-sm text-muted-foreground">
                上传多个文件，AI自动整理和分析
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Title */}
          <Card>
            <CardHeader>
              <CardTitle>笔记标题</CardTitle>
              <CardDescription>为这批内容指定一个标题（可选）</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="留空将自动生成标题"
              />
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                上传文件
              </CardTitle>
              <CardDescription>
                支持PDF、Word、Excel、PPT、图片、音视频等多种格式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.mp3,.mp4,.zip,.rar"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    点击或拖拽文件到此处
                  </p>
                  <p className="text-xs text-muted-foreground">
                    支持 PDF、Word、Excel、PPT、图片、音视频、压缩包
                  </p>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">已选择 {files.length} 个文件</h3>
                    <span className="text-sm text-muted-foreground">
                      总大小: {(totalSize / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>

                  {/* Category Stats */}
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(fileStats).map(([category, count]) => {
                      const Icon = categoryIcons[category] || FileText;
                      return (
                        <Badge key={category} variant="outline">
                          <Icon className={`h-3 w-3 mr-1 ${categoryColors[category]}`} />
                          {category}: {count}
                        </Badge>
                      );
                    })}
                  </div>

                  {/* File Items */}
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {files.map((fileItem, index) => {
                      const Icon = categoryIcons[fileItem.category] || FileText;
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 border rounded-lg"
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              categoryColors[fileItem.category] || "text-gray-500"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {fileItem.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(fileItem.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* URL Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                添加网页链接
              </CardTitle>
              <CardDescription>粘贴网页URL，系统将自动抓取内容</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/article"
                  onKeyPress={(e) => e.key === "Enter" && handleAddUrl()}
                />
                <Button onClick={handleAddUrl}>添加</Button>
              </div>

              {urls.length > 0 && (
                <div className="mt-4 space-y-2">
                  {urls.map((url, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 border rounded-lg"
                    >
                      <LinkIcon className="h-5 w-5 text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{url}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUrl(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Progress */}
          {(uploading || stepError) && (
            <Card>
              <CardContent className="p-6 space-y-5">
                {/* 步骤指示器 */}
                {(() => {
                  const steps = ["上传文件", "提取文本", "AI 生成笔记"];
                  return (
                    <div className="flex items-center justify-between">
                      {steps.map((label, i) => {
                        const step = i + 1;
                        const done = !stepError && currentStep > step;
                        const active = currentStep === step && uploading;
                        const failed = !!stepError && currentStep === step;
                        return (
                          <div key={i} className="flex items-center flex-1">
                            <div className="flex flex-col items-center gap-1">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                  done
                                    ? "bg-green-500 text-white"
                                    : active
                                    ? "bg-blue-500 text-white ring-4 ring-blue-200"
                                    : failed
                                    ? "bg-red-500 text-white"
                                    : "bg-gray-200 text-gray-500"
                                }`}
                              >
                                {done ? (
                                  <CheckCircle className="h-4 w-4" />
                                ) : failed ? (
                                  <AlertCircle className="h-4 w-4" />
                                ) : active ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  step
                                )}
                              </div>
                              <span className={`text-xs whitespace-nowrap ${active ? "text-blue-600 font-medium" : "text-muted-foreground"}`}>
                                {label}
                              </span>
                            </div>
                            {i < steps.length - 1 && (
                              <div
                                className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${
                                  currentStep > step && !stepError ? "bg-green-500" : "bg-gray-200"
                                }`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* 总进度条 */}
                {!stepError && (
                  <Progress value={uploadProgress} className="h-2" />
                )}

                {/* 错误提示 */}
                {stepError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">第 {currentStep} 步失败</p>
                      <p>{stepError}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              onClick={() => { setStepError(null); setCurrentStep(0); handleUpload(); }}
              disabled={(files.length === 0 && urls.length === 0) || uploading}
              size="lg"
              className="flex-1"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  开始处理 ({files.length + urls.length} 项)
                </>
              )}
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/">取消</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
