"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  Eye,
  Shuffle,
  CheckCircle,
  XCircle
} from "lucide-react";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category: string;
  difficulty: number; // 1-3
}

interface FlashcardViewerProps {
  cards: Flashcard[];
}

const difficultyColors = {
  1: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  3: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
};

const difficultyLabels = {
  1: "简单",
  2: "中等",
  3: "困难",
};

export function FlashcardViewer({ cards }: FlashcardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<string>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<string>>(new Set());
  const [shuffledCards, setShuffledCards] = useState<Flashcard[]>(cards);
  const [isShuffled, setIsShuffled] = useState(false);

  if (!cards || cards.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          暂无知识卡片数据
        </CardContent>
      </Card>
    );
  }

  const currentCard = shuffledCards[currentIndex];

  const goToNext = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev + 1) % shuffledCards.length);
  };

  const goToPrev = () => {
    setShowAnswer(false);
    setCurrentIndex((prev) => (prev - 1 + shuffledCards.length) % shuffledCards.length);
  };

  const shuffleCards = () => {
    if (isShuffled) {
      setShuffledCards(cards);
      setIsShuffled(false);
    } else {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setShuffledCards(shuffled);
      setIsShuffled(true);
    }
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const resetProgress = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
  };

  const markAsKnown = () => {
    setKnownCards((prev) => new Set(prev).add(currentCard.id));
    goToNext();
  };

  const markAsUnknown = () => {
    setUnknownCards((prev) => new Set(prev).add(currentCard.id));
    goToNext();
  };

  const progress = shuffledCards.length > 0 
    ? ((knownCards.size + unknownCards.size) / shuffledCards.length) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            🎴 知识卡片
            <Badge variant="outline" className="ml-2">
              {currentIndex + 1} / {shuffledCards.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isShuffled ? "default" : "outline"}
              onClick={shuffleCards}
            >
              <Shuffle className="w-4 h-4 mr-1" />
              随机
            </Button>
            <Button size="sm" variant="outline" onClick={resetProgress}>
              <RotateCcw className="w-4 h-4 mr-1" />
              重置
            </Button>
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>学习进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="text-green-600">已掌握: {knownCards.size}</span>
            <span className="text-red-600">待复习: {unknownCards.size}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 卡片区域 */}
        <div className="relative min-h-[280px]">
          {/* 问题面 */}
          <div
            className={`
              absolute inset-0 p-6 rounded-xl border-2 transition-all duration-300
              ${showAnswer 
                ? "opacity-0 rotate-y-180" 
                : "opacity-100 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-300 dark:border-blue-700"
              }
            `}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={difficultyColors[currentCard.difficulty as keyof typeof difficultyColors]}>
                  {difficultyLabels[currentCard.difficulty as keyof typeof difficultyLabels]}
                </Badge>
                <Badge variant="outline">{currentCard.category}</Badge>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xl font-medium text-center">{currentCard.question}</p>
              </div>
              <div className="text-center text-muted-foreground text-sm mt-4">
                点击下方按钮查看答案
              </div>
            </div>
          </div>
          
          {/* 答案面 */}
          <div
            className={`
              absolute inset-0 p-6 rounded-xl border-2 transition-all duration-300
              ${showAnswer 
                ? "opacity-100 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 border-green-300 dark:border-green-700" 
                : "opacity-0 rotate-y-180"
              }
            `}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline">答案</Badge>
              </div>
              <div className="flex-1 flex items-center justify-center">
                <p className="text-lg text-center leading-relaxed">{currentCard.answer}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={goToPrev}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            上一题
          </Button>
          
          <div className="flex gap-2">
            {!showAnswer ? (
              <Button onClick={() => setShowAnswer(true)}>
                <Eye className="w-4 h-4 mr-1" />
                显示答案
              </Button>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700"
                  onClick={markAsUnknown}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  不会
                </Button>
                <Button 
                  variant="outline" 
                  className="text-green-600 hover:text-green-700"
                  onClick={markAsKnown}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  会了
                </Button>
              </>
            )}
          </div>
          
          <Button variant="outline" onClick={goToNext}>
            下一题
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* 所有卡片预览 */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium text-muted-foreground mb-3">所有卡片预览：</p>
          <div className="flex flex-wrap gap-2">
            {shuffledCards.map((card, index) => (
              <button
                key={card.id}
                onClick={() => {
                  setCurrentIndex(index);
                  setShowAnswer(false);
                }}
                className={`
                  w-8 h-8 rounded-full text-sm font-medium transition-all
                  ${index === currentIndex 
                    ? "bg-blue-500 text-white ring-2 ring-blue-300" 
                    : knownCards.has(card.id)
                      ? "bg-green-500 text-white"
                      : unknownCards.has(card.id)
                        ? "bg-red-500 text-white"
                        : "bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600"
                  }
                `}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
