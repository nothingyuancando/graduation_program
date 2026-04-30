"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, GitFork, Loader2, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SharedNote = {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[] | null;
  subject?: string | null;
  updated_at?: string | null;
  fork_count?: number | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\[\[([^\]\n]+)\]\]/g, (_, rawConcept: string) => {
      const concept = rawConcept.trim();
      return `<a href="/concepts/${encodeURIComponent(concept)}" class="rounded-md bg-cyan-50 px-1.5 py-0.5 font-medium text-cyan-700 no-underline hover:bg-cyan-100">[[${escapeHtml(concept)}]]</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm">$1</code>');
}

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("- ")) {
      if (!inList) {
        html.push('<ul class="my-3 list-disc space-y-1 pl-5">');
        inList = true;
      }
      html.push(`<li>${renderInlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      html.push("</ul>");
      inList = false;
    }

    if (!line.trim()) {
      html.push("");
    } else if (line.startsWith("### ")) {
      html.push(`<h3 class="mt-6 text-xl font-black">${renderInlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      html.push(`<h2 class="mt-8 border-l-4 border-slate-950 pl-3 text-2xl font-black">${renderInlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      html.push(`<h1 class="mb-4 text-3xl font-black">${renderInlineMarkdown(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      html.push(`<blockquote class="my-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-slate-700">${renderInlineMarkdown(line.slice(2))}</blockquote>`);
    } else {
      html.push(`<p class="my-3 leading-8 text-slate-700">${renderInlineMarkdown(line)}</p>`);
    }
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

export default function SharedNotePage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const [note, setNote] = useState<SharedNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/public-notes/${noteId}`);
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || "公开笔记不存在");
          return;
        }
        setNote(data.note);
      } catch (loadError) {
        console.error("Error loading shared note:", loadError);
        setError("加载公开笔记失败");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [noteId]);

  const handleFork = async () => {
    setForking(true);
    setError("");
    try {
      const response = await fetch(`/api/public-notes/${noteId}/fork`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Fork 失败，请确认已经登录");
        return;
      }
      router.push(`/notes/${data.note.id}`);
    } catch (forkError) {
      console.error("Error forking note:", forkError);
      setError("Fork 失败，请稍后重试");
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-950/10 bg-[#fbf7ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 md:px-8">
          <Button variant="ghost" asChild>
            <Link href="/explore">
              <ArrowLeft className="mr-2 h-4 w-4" />
              公开笔记广场
            </Link>
          </Button>
          <Button onClick={handleFork} disabled={forking || !note} className="bg-slate-950 text-white hover:bg-slate-800">
            {forking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitFork className="mr-2 h-4 w-4" />}
            Fork 到我的知识库
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 md:px-8">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : error && !note ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center text-red-700">{error}</CardContent>
          </Card>
        ) : note ? (
          <>
            <section className="rounded-2xl border border-slate-950/10 bg-white/80 p-6 shadow-sm md:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <Badge className="bg-slate-950 text-white hover:bg-slate-950">
                  <Share2 className="mr-1 h-3 w-3" />
                  公开分享
                </Badge>
                {note.subject && <Badge className="bg-cyan-50 text-cyan-700 hover:bg-cyan-50">{note.subject}</Badge>}
                <Badge variant="outline">
                  <GitFork className="mr-1 h-3 w-3" />
                  {note.fork_count || 0} Fork
                </Badge>
              </div>
              <h1 className="text-3xl font-black tracking-tight md:text-5xl">{note.title}</h1>
              {note.summary && <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">{note.summary}</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {(note.tags || []).map((tag) => (
                  <Badge key={tag} variant="outline">#{tag}</Badge>
                ))}
              </div>
              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            </section>

            <Card className="border-slate-950/10 bg-white/90 shadow-sm">
              <CardHeader>
                <CardTitle>笔记内容</CardTitle>
              </CardHeader>
              <CardContent>
                <article
                  className="max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content || "") }}
                />
              </CardContent>
            </Card>
          </>
        ) : null}
      </main>
    </div>
  );
}
