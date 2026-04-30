"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, PenLine, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "快速记录",
          content: content.trim(),
          contentType: "text",
          sourceType: "text",
          status: "draft",
        }),
      });

      if (!response.ok) {
        toast.error("保存失败，请稍后重试");
        return;
      }

      toast.success("已保存到草稿");
      setTitle("");
      setContent("");
      setOpen(false);
    } catch (error) {
      console.error("Error saving quick capture:", error);
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
        title="快速记草稿 Ctrl+Shift+N"
        type="button"
      >
        <PenLine className="h-5 w-5" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            type="button"
            aria-label="关闭快速记录"
          />
          <div className="fixed bottom-20 right-6 z-50 w-[min(22rem,calc(100vw-3rem))] space-y-3 rounded-2xl border border-slate-950/10 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">快速记草稿</p>
                <p className="text-xs text-slate-500">只记录想法，稍后再整理成学习笔记</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Input
              placeholder="标题，可留空"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="text-sm"
            />
            <Textarea
              ref={textareaRef}
              placeholder="先把想法写下来..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              className="resize-none text-sm"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void handleSave();
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Ctrl+Enter 保存</span>
              <Button size="sm" onClick={handleSave} disabled={!content.trim() || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                保存草稿
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
