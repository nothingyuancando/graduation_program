"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  FileText,
  Upload,
  Globe,
  Loader2,
  CheckCircle,
} from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("text");

  // Text upload state
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");
  const [fileLoading, setFileLoading] = useState(false);

  // URL upload state
  const [url, setUrl] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTextLoading(true);

    try {
      const response = await fetch("/api/upload/text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: textTitle,
          content: textContent,
          contentType: "text",
        }),
      });

      const data = await response.json();
      if (data.note) {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (error) {
      console.error("Error uploading text:", error);
    } finally {
      setTextLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setFileLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (fileTitle) {
        formData.append("title", fileTitle);
      }

      const endpoint = file.type === "application/pdf" ? "/api/upload/pdf" : "/api/upload/image";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.note) {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setFileLoading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlLoading(true);

    try {
      const response = await fetch("/api/upload/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url,
          title: urlTitle,
        }),
      });

      const data = await response.json();
      if (data.note) {
        router.push(`/notes/${data.note.id}`);
      }
    } catch (error) {
      console.error("Error processing URL:", error);
    } finally {
      setUrlLoading(false);
    }
  };

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
              <h1 className="text-2xl font-bold">导入内容</h1>
              <p className="text-sm text-muted-foreground">支持文本、文件、URL多种导入方式</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">文本</TabsTrigger>
              <TabsTrigger value="file">文件</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    创建文本笔记
                  </CardTitle>
                  <CardDescription>
                    直接输入文本内容，AI将自动分析和提取关键信息
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTextSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="text-title">标题</Label>
                      <Input
                        id="text-title"
                        value={textTitle}
                        onChange={(e) => setTextTitle(e.target.value)}
                        placeholder="输入笔记标题"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="text-content">内容</Label>
                      <Textarea
                        id="text-content"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="输入笔记内容..."
                        rows={10}
                        required
                      />
                    </div>
                    <Button type="submit" disabled={textLoading} className="w-full">
                      {textLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          创建中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          创建笔记
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="file">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-green-500" />
                    上传文件
                  </CardTitle>
                  <CardDescription>
                    支持 PDF 和图片格式，AI 将自动提取和分析内容
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleFileUpload} className="space-y-4">
                    <div>
                      <Label htmlFor="file-upload">选择文件</Label>
                      <div className="mt-2">
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".pdf,image/*"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          required
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          支持 PDF、JPG、PNG、GIF 等格式
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="file-title">标题（可选）</Label>
                      <Input
                        id="file-title"
                        value={fileTitle}
                        onChange={(e) => setFileTitle(e.target.value)}
                        placeholder="留空则使用文件名"
                      />
                    </div>
                    <Button type="submit" disabled={fileLoading || !file} className="w-full">
                      {fileLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          上传并分析
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="url">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-500" />
                    导入 URL 内容
                  </CardTitle>
                  <CardDescription>
                    输入文章 URL，AI 将自动抓取并提取内容
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUrlSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="url-input">URL</Label>
                      <Input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com/article"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="url-title">标题（可选）</Label>
                      <Input
                        id="url-title"
                        value={urlTitle}
                        onChange={(e) => setUrlTitle(e.target.value)}
                        placeholder="留空则使用网页标题"
                      />
                    </div>
                    <Button type="submit" disabled={urlLoading} className="w-full">
                      {urlLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          抓取中...
                        </>
                      ) : (
                        <>
                          <Globe className="h-4 w-4 mr-2" />
                          抓取并分析
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
