"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Trophy,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface HistoryItem {
  id: string;
  quiz_id: string;
  quiz_title: string;
  note_title: string;
  note_id: string;
  score: string;
  total_correct: number;
  total_questions: number;
  answers: Array<{
    question_id: string;
    user_answer: string;
    is_correct: boolean;
    ai_feedback?: string;
  }>;
  weak_points: string[];
  completed_at: string;
}

export default function QuizHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/quiz/history?limit=50");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    return "text-orange-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">测验历史</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">还没有测验记录</p>
                <p className="text-sm text-muted-foreground">在笔记详情页中生成练习测验开始学习吧</p>
              </CardContent>
            </Card>
          ) : (
            history.map((item) => {
              const score = parseFloat(item.score);
              const isExpanded = expandedId === item.id;
              return (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold">{item.quiz_title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          {item.note_title && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {item.note_title}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(item.completed_at).toLocaleString("zh-CN")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className={`text-xl font-bold ${getScoreColor(score)}`}>
                            {score.toFixed(0)}分
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.total_correct}/{item.total_questions}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {item.answers.map((answer, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            {answer.is_correct ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <span className={answer.is_correct ? "text-green-600" : "text-red-600"}>
                                {answer.user_answer || "未作答"}
                              </span>
                              {answer.ai_feedback && (
                                <p className="text-muted-foreground mt-0.5">{answer.ai_feedback}</p>
                              )}
                            </div>
                          </div>
                        ))}

                        {item.weak_points && item.weak_points.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs text-muted-foreground mb-1">需要加强的知识点：</p>
                            <div className="flex flex-wrap gap-1">
                              {item.weak_points.map((wp, i) => (
                                <Badge key={i} variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                                  {wp.length > 30 ? wp.substring(0, 30) + "..." : wp}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.note_id && (
                          <div className="pt-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/quiz/${item.note_id}`}>
                                重新练习
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
