"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, CheckCircle, RotateCcw } from "lucide-react";

interface ReviewCard {
  id: string;
  note_id: string;
  card_index: number;
  question: string;
  answer: string;
  interval_days: number;
}

const RATINGS = [
  { quality: 1, label: "完全忘了", color: "bg-red-500 hover:bg-red-600" },
  { quality: 2, label: "困难", color: "bg-orange-500 hover:bg-orange-600" },
  { quality: 3, label: "还行", color: "bg-yellow-500 hover:bg-yellow-600" },
  { quality: 4, label: "简单", color: "bg-green-500 hover:bg-green-600" },
];

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => {
        setCards(d.cards || []);
        setTotalCards(d.totalCards || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const current = cards[currentIdx];

  const handleRate = async (quality: number) => {
    if (!current || submitting) return;
    setSubmitting(true);
    await fetch("/api/review/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: current.id, quality }),
    });
    setSubmitting(false);
    setReviewedCount((c) => c + 1);
    const next = currentIdx + 1;
    if (next >= cards.length) {
      setDone(true);
    } else {
      setCurrentIdx(next);
      setFlipped(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              今日复习
            </h1>
            <p className="text-xs text-muted-foreground">共 {totalCards} 张卡片 · 今日待复习 {cards.length} 张</p>
          </div>
          {cards.length > 0 && !done && (
            <div className="ml-auto text-sm text-muted-foreground">
              {currentIdx + 1} / {cards.length}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-xl">
        {done || cards.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">
              {cards.length === 0 ? "今日暂无待复习卡片" : "今日复习完成！"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {cards.length === 0
                ? `你共有 ${totalCards} 张卡片，明天再来复习吧`
                : `完成了 ${reviewedCount} 张卡片的复习，保持下去！`}
            </p>
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 进度条 */}
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${(currentIdx / cards.length) * 100}%` }}
              />
            </div>

            {/* 卡片 */}
            <div
              className="cursor-pointer select-none"
              onClick={() => !flipped && setFlipped(true)}
              style={{ perspective: 1000 }}
            >
              <div
                className="relative transition-transform duration-500"
                style={{
                  transformStyle: "preserve-3d",
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  minHeight: 240,
                }}
              >
                {/* 正面（问题） */}
                <Card
                  className="absolute inset-0"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <CardContent className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[240px]">
                    <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">问题</p>
                    <p className="text-xl font-semibold leading-relaxed">{current.question}</p>
                    {!flipped && (
                      <p className="text-xs text-muted-foreground mt-6">点击翻转查看答案</p>
                    )}
                  </CardContent>
                </Card>

                {/* 背面（答案） */}
                <Card
                  className="absolute inset-0 border-blue-200 dark:border-blue-800"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <CardContent className="h-full flex flex-col items-center justify-center p-8 text-center min-h-[240px]">
                    <p className="text-xs text-muted-foreground mb-4 uppercase tracking-wider">答案</p>
                    <p className="text-base leading-relaxed">{current.answer}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 评分按钮（翻转后显示） */}
            {flipped ? (
              <div className="space-y-3">
                <p className="text-center text-sm text-muted-foreground">你记得多少？</p>
                <div className="grid grid-cols-4 gap-2">
                  {RATINGS.map((r) => (
                    <button
                      key={r.quality}
                      onClick={() => handleRate(r.quality)}
                      disabled={submitting}
                      className={`${r.color} text-white text-sm font-medium rounded-xl py-3 transition-all hover:scale-105 disabled:opacity-50`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setFlipped(true)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  显示答案
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
