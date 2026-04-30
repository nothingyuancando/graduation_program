import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";
import { getUserFromRequest } from "@/lib/auth";

type QuizQuestion = {
  id: string;
  type: "choice" | "fill" | "short_answer";
  question: string;
  correct_answer: string;
  explanation?: string;
};

type UserAnswer = {
  question_id: string;
  user_answer: string;
};

type GradedAnswer = {
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  score: number;
  ai_feedback: string;
};

type AiGradingResult = {
  index: number;
  score?: number;
  feedback?: string;
};

type WeakConcept = {
  concept: string;
  score: number;
  lastSeen: string;
};

// POST /api/quiz/[quizId]/submit — 提交答案 + AI 批改（0-100评分） + 更新学习画像
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  const quizId = (await params).quizId;
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();
    const body = await request.json();
    const { answers: userAnswers } = body as { answers?: UserAnswer[] }; // Array<{question_id, user_answer}>

    if (!userAnswers || !Array.isArray(userAnswers)) {
      return NextResponse.json({ error: "请提供答案" }, { status: 400 });
    }

    // 获取测验题目
    const { data: quiz, error: quizError } = await client
      .from("quizzes")
      .select("*")
      .eq("id", quizId)
      .eq("user_id", user.id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: "测验不存在" }, { status: 404 });
    }

    const questions = quiz.questions as QuizQuestion[];
    const gradedAnswers: GradedAnswer[] = [];
    const weakPoints: string[] = [];

    // 先处理选择题（精确匹配）+ 收集需要 AI 评分的题目
    const needAiGrading: Array<{ index: number; question: QuizQuestion; userAnswer: string }> = [];

    for (const ua of userAnswers) {
      const question = questions.find((q) => q.id === ua.question_id);
      if (!question) continue;

      if (question.type === "choice") {
        // 选择题精确匹配：正确100分，错误0分
        const isCorrect = ua.user_answer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase();
        if (!isCorrect) {
          weakPoints.push(question.question);
        }
        gradedAnswers.push({
          question_id: ua.question_id,
          user_answer: ua.user_answer,
          is_correct: isCorrect,
          score: isCorrect ? 100 : 0,
          ai_feedback: isCorrect
            ? "回答正确！"
            : `正确答案是 ${question.correct_answer}。${question.explanation || ""}`,
        });
      } else {
        // 填空题/简答题：空答案直接0分，非空交给AI评分
        const trimmedAnswer = (ua.user_answer || "").trim();
        if (!trimmedAnswer) {
          gradedAnswers.push({
            question_id: ua.question_id,
            user_answer: ua.user_answer,
            is_correct: false,
            score: 0,
            ai_feedback: `未作答。参考答案：${question.correct_answer}`,
          });
          weakPoints.push(question.question);
        } else {
          needAiGrading.push({
            index: gradedAnswers.length,
            question,
            userAnswer: trimmedAnswer,
          });
          // 占位
          gradedAnswers.push({
            question_id: ua.question_id,
            user_answer: ua.user_answer,
            is_correct: false,
            score: 0,
            ai_feedback: "",
          });
        }
      }
    }

    // 批量 AI 评分填空题和简答题（0-100分）
    if (needAiGrading.length > 0) {
      const gradingPrompt = needAiGrading.map((item, i) => {
        return `题目 ${i + 1}：
类型：${item.question.type === "fill" ? "填空题" : "简答题"}
题目：${item.question.question}
参考答案：${item.question.correct_answer}
学生回答：${item.userAnswer}`;
      }).join("\n\n");

      const prompt = `你是一个严格的教师助手。请对以下${needAiGrading.length}道题目进行评分。

${gradingPrompt}

请以JSON格式返回评分结果：
{
  "results": [
    {
      "index": 0,
      "score": 75,
      "feedback": "评分反馈（简短说明扣分原因）"
    }
  ]
}

评分标准（务必严格遵守）：
1. 评分范围：0-100的整数，基于学生答案与参考答案的语义相关性和正确性
2. 空答案或完全无关的答案：必须给0分
3. 填空题：答案意思完全正确给90-100分，部分正确按比例给分，完全错误给0分
4. 简答题：覆盖所有要点给90-100分，覆盖大部分要点给60-89分，覆盖少部分要点给20-59分，完全跑题给0分
5. 不要因为"答了就给分"的思路而慷慨评分——必须严格基于答案与参考答案的实际相关性评分
6. score必须是0到100之间的整数`;

      try {
        const llmClient = createLLMClient({ userId: user.id });
        const response = await llmClient.invoke(
          [
            { role: "system", content: "你是一个严格的教师助手，擅长根据参考答案对学生回答进行精确评分。你必须严格根据答案相关性给分，绝不宽松评分。" },
            { role: "user", content: prompt },
          ],
          { temperature: 0.1 }
        );

        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const gradingResult = JSON.parse(jsonMatch[0]);
          for (const result of (gradingResult.results || []) as AiGradingResult[]) {
            const item = needAiGrading[result.index];
            if (item) {
              const questionScore = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
              gradedAnswers[item.index] = {
                ...gradedAnswers[item.index],
                is_correct: questionScore >= 60,
                score: questionScore,
                ai_feedback: result.feedback || "",
              };
              if (questionScore < 60) weakPoints.push(item.question.question);
            }
          }
        }
      } catch (aiError) {
        console.error("AI grading error:", aiError);
        // AI 评分失败时，用简单字符串比较给部分分
        for (const item of needAiGrading) {
          const userNorm = item.userAnswer.toLowerCase();
          const refNorm = item.question.correct_answer.trim().toLowerCase();
          let fallbackScore = 0;
          if (userNorm === refNorm) fallbackScore = 100;
          else if (userNorm.includes(refNorm) || refNorm.includes(userNorm)) fallbackScore = 70;
          else fallbackScore = 0;

          gradedAnswers[item.index] = {
            ...gradedAnswers[item.index],
            is_correct: fallbackScore >= 60,
            score: fallbackScore,
            ai_feedback: fallbackScore >= 60 ? "回答正确！" : `参考答案：${item.question.correct_answer}`,
          };
          if (fallbackScore < 60) weakPoints.push(item.question.question);
        }
      }
    }

    // 计算总分：所有题目得分的平均值
    const totalQuestions = questions.length;
    const totalScore = gradedAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    const score = totalQuestions > 0 ? totalScore / totalQuestions : 0;
    const totalCorrect = gradedAnswers.filter((a) => (a.score ?? 0) >= 60).length;

    // 保存作答记录
    const { data: attempt, error: attemptError } = await client
      .from("quiz_attempts")
      .insert({
        user_id: user.id,
        quiz_id: quizId,
        answers: gradedAnswers,
        score: score.toFixed(2),
        total_correct: totalCorrect,
        total_questions: totalQuestions,
        weak_points: weakPoints,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // 更新用户学习画像的薄弱概念（根据得分权重调整）
    if (weakPoints.length > 0) {
      const { data: existingProfile } = await client
        .from("user_learning_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (existingProfile) {
        const currentWeak = (existingProfile.weak_concepts as WeakConcept[]) || [];
        const now = new Date().toISOString();
        const newWeakConcepts = [...currentWeak];

        for (const wp of weakPoints) {
          const shortConcept = wp.length > 50 ? wp.substring(0, 50) + "..." : wp;
          // 找到对应题目的得分来加权
          const gradedItem = gradedAnswers.find((a) =>
            questions.find((q) => q.id === a.question_id && q.question === wp)
          );
          const qScore = gradedItem?.score ?? 0;
          const weakness = (1 - qScore / 100) * 0.2; // 得分越低，权重越大

          const existing = newWeakConcepts.find((c) => c.concept === shortConcept);
          if (existing) {
            existing.score = Math.min((existing.score || 0) + weakness, 1);
            existing.lastSeen = now;
          } else {
            newWeakConcepts.push({ concept: shortConcept, score: 0.3, lastSeen: now });
          }
        }

        // 保留最近 20 个薄弱概念
        newWeakConcepts.sort((a, b) => b.score - a.score);
        const trimmed = newWeakConcepts.slice(0, 20);

        await client
          .from("user_learning_profiles")
          .update({ weak_concepts: trimmed, updated_at: now })
          .eq("user_id", user.id);
      }
    }

    // 更新今日打卡的测验数
    const today = new Date().toISOString().split("T")[0];
    const { data: checkin } = await client
      .from("study_checkins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (checkin) {
      await client
        .from("study_checkins")
        .update({ quizzes_taken: (checkin.quizzes_taken || 0) + 1 })
        .eq("id", checkin.id);
    }

    return NextResponse.json({
      attempt,
      score: parseFloat(score.toFixed(2)),
      totalCorrect,
      totalQuestions,
      gradedAnswers,
      weakPoints,
      message: "批改完成",
    });
  } catch (error) {
    console.error("Error submitting quiz:", error);
    return NextResponse.json({ error: "提交测验失败" }, { status: 500 });
  }
}
