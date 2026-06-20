"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Loader2, Send, User, Wrench } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const quickQuestions = [
  "帮我总结最近的重点笔记",
  "我现在最薄弱的知识点是什么",
  "帮我找概率论相关的笔记",
  "根据某篇笔记给我生成一套练习题",
];

const toolNameMap: Record<string, string> = {
  search_notes: "搜索笔记",
  get_note_detail: "读取笔记",
  get_learning_profile: "获取学习画像",
  get_related_notes: "查找相关笔记",
  analyze_note: "分析笔记",
  generate_quiz: "生成练习题",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeTool]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    setActiveTool(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;

          try {
            const event = JSON.parse(data);
            if (event.type === "token") {
              fullAnswer += event.data;
              setMessages([
                ...nextMessages,
                { role: "assistant", content: fullAnswer },
              ]);
            } else if (event.type === "tool_start") {
              setActiveTool(event.data);
            } else if (event.type === "tool_end") {
              setActiveTool(null);
            } else if (event.type === "error") {
              fullAnswer += event.data;
              setMessages([
                ...nextMessages,
                { role: "assistant", content: fullAnswer },
              ]);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "抱歉，Agent 处理请求时出现错误，请稍后重试。",
        },
      ]);
    } finally {
      setStreaming(false);
      setActiveTool(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <header className="shrink-0 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <BackButton variant="ghost" size="sm">
<ArrowLeft className="mr-2 h-4 w-4" />
              返回
              </BackButton>
          <div>
            <h1 className="text-lg font-semibold">智能学习 Agent</h1>
            <p className="text-xs text-muted-foreground">
              基于 LangGraph 的多工具编排 Agent，支持流式对话
            </p>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          {messages.length === 0 && (
            <section className="rounded-3xl border bg-white p-8 shadow-sm">
              <Bot className="mb-4 h-10 w-10 text-sky-600" />
              <h2 className="text-xl font-semibold">
                现在它不只是问答，而是一个可执行任务的学习 Agent。
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                你可以让它先找笔记、再分析、再给出建议，也可以直接让它帮你生成练习题。
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setInput(question);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border bg-slate-50 px-3 py-2 text-sm transition hover:bg-slate-100"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </section>
          )}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === "user"
                    ? "rounded-tr-sm bg-sky-600 text-white"
                    : "rounded-tl-sm border bg-white shadow-sm"
                }`}
              >
                {message.content}
                {message.role === "assistant" && message.content === "" && !activeTool && (
                  <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-current" />
                )}
              </div>

              {message.role === "user" && (
                <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {activeTool && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Wrench className="h-4 w-4 animate-spin" />
              </div>
              <span>
                正在{toolNameMap[activeTool] || activeTool}...
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="shrink-0 border-t bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="试试：帮我找出线性代数里最薄弱的 3 个知识点"
            disabled={streaming}
            className="flex-1"
          />
          <Button
            onClick={() => void sendMessage()}
            disabled={!input.trim() || streaming}
            size="icon"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
