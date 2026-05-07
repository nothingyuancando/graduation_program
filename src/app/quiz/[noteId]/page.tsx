"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Brain,
  Loader2,
  Plus,
  CheckCircle,
  XCircle,
  Trophy,
  Clock,
} from "lucide-react";

interface Question {
  id: string;
  type: "choice" | "fill" | "short_answer";
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  question_count: number;
  created_at: string;
  best_score?: number | null;
  attempted?: boolean;
}

interface GradedAnswer {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  score?: number; // 0-100 per question
  ai_feedback?: string;
}

export default function QuizPage() {
  const params = useParams();
  const noteId = params.noteId as string;

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 答题状态
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    score: number;
    totalCorrect: number;
    totalQuestions: number;
    gradedAnswers: GradedAnswer[];
    weakPoints: string[];
  } | null>(null);

  const [noteTitle, setNoteTitle] = useState("");

  useEffect(() => {
    fetchQuizzes();
    fetchNoteTitle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const fetchNoteTitle = async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      const data = await res.json();
      if (data.note) setNoteTitle(data.note.title);
    } catch {}
  };

  const fetchQuizzes = async () => {
    try {
      const res = await fetch(`/api/notes/${noteId}/quiz`);
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError("");
    try {
      const res = await fetch(`/api/notes/${noteId}/quiz/generate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.detail || data.error || "生成测验失败，请稍后重试");
        return;
      }
      if (data.quiz) {
        await fetchQuizzes();
        // 自动进入新生成的测验
        setActiveQuiz(data.quiz);
        setAnswers({});
        setResult(null);
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      setGenerateError("生成测验失败，请检查网络或稍后重试");
    } finally {
      setGenerating(false);
    }
  };

  const handleStartQuiz = async (quizId: string) => {
    try {
      const res = await fetch(`/api/quiz/${quizId}`);
      const data = await res.json();
      if (data.quiz) {
        setActiveQuiz(data.quiz);
        setAnswers({});
        setResult(null);
      }
    } catch (error) {
      console.error("Error loading quiz:", error);
    }
  };

  const handleSubmit = async () => {
    if (!activeQuiz) return;
    setSubmitting(true);
    try {
      const answersList = activeQuiz.questions.map((q) => ({
        question_id: q.id,
        user_answer: answers[q.id] || "",
      }));

      const res = await fetch(`/api/quiz/${activeQuiz.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersList }),
      });
      const data = await res.json();
      if (data.gradedAnswers) {
        setResult({
          score: data.score,
          totalCorrect: data.totalCorrect,
          totalQuestions: data.totalQuestions,
          gradedAnswers: data.gradedAnswers,
          weakPoints: data.weakPoints,
        });
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const getDifficultyColor = (d: string) => {
    switch (d) {
      case "easy": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "hard": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "";
    }
  };

  const getDifficultyText = (d: string) => {
    switch (d) {
      case "easy": return "简单";
      case "medium": return "中等";
      case "hard": return "困难";
      default: return d;
    }
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/notes/${noteId}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回笔记
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">练习测验</h1>
                {noteTitle && (
                  <p className="text-sm text-muted-foreground">{noteTitle}</p>
                )}
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {generating ? "AI 生成中..." : "生成新测验"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {generateError && (
          <div className="mx-auto mb-6 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {generateError}
          </div>
        )}

        {activeQuiz && !result ? (
          /* 答题界面 */
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{activeQuiz.title}</CardTitle>
                <CardDescription>共 {activeQuiz.questions.length} 道题目，请完成后提交</CardDescription>
              </CardHeader>
            </Card>

            {activeQuiz.questions.map((q, index) => (
              <Card key={q.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">第 {index + 1} 题</span>
                    <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                      {getDifficultyText(q.difficulty)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {q.type === "choice" ? "选择题" : q.type === "fill" ? "填空题" : "简答题"}
                    </Badge>
                  </div>
                  <CardDescription className="text-foreground text-base mt-2">
                    {q.question}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {q.type === "choice" && q.options ? (
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    >
                      {q.options.map((opt, i) => {
                        const optionLetter = opt.charAt(0);
                        return (
                          <div key={i} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800">
                            <RadioGroupItem value={optionLetter} id={`${q.id}-${i}`} />
                            <Label htmlFor={`${q.id}-${i}`} className="cursor-pointer flex-1">
                              {opt}
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  ) : q.type === "fill" ? (
                    <Input
                      placeholder="请输入答案"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                  ) : (
                    <Textarea
                      placeholder="请输入你的回答"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={4}
                    />
                  )}
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3">
              <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {submitting ? "AI 批改中..." : "提交答案"}
              </Button>
              <Button variant="outline" onClick={() => { setActiveQuiz(null); setAnswers({}); }}>
                取消
              </Button>
            </div>
          </div>
        ) : result ? (
          /* 成绩单 */
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardContent className="p-8 text-center">
                <Trophy className={`h-12 w-12 mx-auto mb-4 ${result.score >= 80 ? "text-yellow-500" : result.score >= 60 ? "text-blue-500" : "text-slate-400"}`} />
                <div className="text-4xl font-bold mb-2">
                  {result.score.toFixed(1)}<span className="text-lg">分</span>
                </div>
                <p className="text-muted-foreground">
                  {result.totalCorrect} / {result.totalQuestions} 题达标（60分以上）
                </p>
                {result.score >= 80 ? (
                  <Badge className="mt-3 bg-green-500">优秀</Badge>
                ) : result.score >= 60 ? (
                  <Badge className="mt-3 bg-blue-500">良好</Badge>
                ) : (
                  <Badge className="mt-3 bg-orange-500">继续加油</Badge>
                )}
              </CardContent>
            </Card>

            {/* 逐题批改 */}
            {activeQuiz?.questions.map((q, index) => {
              const graded = result.gradedAnswers.find((a) => a.question_id === q.id);
              const qScore = graded?.score ?? (graded?.is_correct ? 100 : 0);
              const borderClass = qScore >= 80
                ? "border-green-200 dark:border-green-800"
                : qScore >= 60
                ? "border-yellow-200 dark:border-yellow-800"
                : "border-red-200 dark:border-red-800";
              const scoreColor = qScore >= 80
                ? "text-green-600"
                : qScore >= 60
                ? "text-yellow-600"
                : "text-red-600";
              return (
                <Card key={q.id} className={borderClass}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {qScore >= 80 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : qScore >= 60 ? (
                        <CheckCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">第 {index + 1} 题</span>
                      <Badge variant="outline" className={getDifficultyColor(q.difficulty)}>
                        {getDifficultyText(q.difficulty)}
                      </Badge>
                      <span className={`ml-auto font-bold text-lg ${scoreColor}`}>
                        {qScore}<span className="text-xs font-normal text-muted-foreground">/100</span>
                      </span>
                    </div>
                    <p className="text-sm mt-2">{q.question}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">你的答案：</span>
                      <span className={qScore >= 60 ? "text-green-600" : "text-red-600"}>
                        {graded?.user_answer || "未作答"}
                      </span>
                    </div>
                    {qScore < 100 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">参考答案：</span>
                        <span className="text-green-600">{q.correct_answer}</span>
                      </div>
                    )}
                    {graded?.ai_feedback && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                        <span className="font-medium text-blue-600">AI 反馈：</span>
                        {graded.ai_feedback}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">解析：</span>{q.explanation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex gap-3">
              <Button onClick={() => { setResult(null); setAnswers({}); }} variant="outline" className="flex-1">
                重新作答
              </Button>
              <Button onClick={() => { setActiveQuiz(null); setResult(null); setAnswers({}); }} className="flex-1">
                返回测验列表
              </Button>
            </div>
          </div>
        ) : (
          /* 测验列表 */
          <div className="max-w-3xl mx-auto space-y-4">
            {quizzes.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">还没有练习测验</p>
                  <Button onClick={handleGenerate} disabled={generating}>
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {generating ? "AI 生成中..." : "生成第一份测验"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              quizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleStartQuiz(quiz.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{quiz.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Brain className="h-3.5 w-3.5" />
                            {quiz.question_count} 题
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(quiz.created_at).toLocaleDateString("zh-CN")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {quiz.best_score !== null && quiz.best_score !== undefined ? (
                          <div>
                            <div className={`text-lg font-bold ${quiz.best_score >= 80 ? "text-green-600" : quiz.best_score >= 60 ? "text-blue-600" : "text-orange-600"}`}>
                              {quiz.best_score.toFixed(0)}分
                            </div>
                            <span className="text-xs text-muted-foreground">最高分</span>
                          </div>
                        ) : (
                          <Badge variant="outline">未作答</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
