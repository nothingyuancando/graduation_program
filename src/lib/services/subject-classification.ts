import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";

export interface SubjectClassificationInput {
  userId?: string;
  noteId?: string;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[];
  themes?: Array<{ name: string; importance?: number }>;
  subjectCandidates?: string[];
}

export interface SubjectClassificationResult {
  subject: string;
  confidence: number;
  reason: string;
  matchedKeywords: string[];
  alternativeSubjects: Array<{ subject: string; confidence: number }>;
  source: "rule" | "llm" | "fallback" | "manual";
}

interface NoteForClassification {
  id: string;
  user_id?: string;
  title?: string;
  content?: string;
  summary?: string | null;
  tags?: string[];
  themes?: Array<{ name: string; importance?: number }>;
  subject?: string | null;
  subject_confidence?: number | string | null;
  subject_reason?: string | null;
  classification_source?: string | null;
}

interface UserSubjectLevel {
  subject?: string;
}

interface ParsedAlternativeSubject {
  subject?: string;
  confidence?: number;
}

const DEFAULT_SUBJECTS = [
  "数据结构",
  "算法",
  "操作系统",
  "计算机网络",
  "数据库",
  "计算机组成原理",
  "软件工程",
  "人工智能",
  "机器学习",
  "前端开发",
  "后端开发",
  "高等数学",
  "线性代数",
  "概率论",
  "英语",
  "政治",
  "论文阅读",
  "未分类",
];

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  数据结构: ["栈", "队列", "链表", "树", "二叉树", "图", "遍历", "堆", "哈希表", "复杂度"],
  算法: ["排序", "查找", "递归", "动态规划", "贪心", "回溯", "分治", "最短路径", "算法"],
  操作系统: ["进程", "线程", "死锁", "调度", "内存管理", "虚拟内存", "文件系统", "同步", "互斥"],
  计算机网络: ["TCP", "UDP", "HTTP", "IP", "DNS", "路由", "拥塞控制", "三次握手", "网络层"],
  数据库: ["SQL", "事务", "索引", "范式", "锁", "MVCC", "查询优化", "关系模型", "数据库"],
  计算机组成原理: ["CPU", "流水线", "缓存", "指令", "总线", "存储器", "寄存器", "中断"],
  软件工程: ["需求", "设计模式", "测试", "UML", "敏捷", "架构", "重构", "项目管理"],
  人工智能: ["智能体", "搜索", "知识表示", "推理", "专家系统", "规划", "Agent"],
  机器学习: ["回归", "分类", "聚类", "神经网络", "损失函数", "训练集", "模型", "梯度"],
  前端开发: ["React", "Vue", "Next.js", "CSS", "HTML", "组件", "浏览器", "Tailwind"],
  后端开发: ["API", "服务端", "Node", "鉴权", "缓存", "队列", "微服务", "接口"],
  高等数学: ["极限", "导数", "积分", "微分", "级数", "多元函数", "偏导"],
  线性代数: ["矩阵", "行列式", "向量", "特征值", "线性方程组", "秩", "正交"],
  概率论: ["概率", "随机变量", "分布", "期望", "方差", "贝叶斯", "大数定律"],
  英语: ["单词", "语法", "阅读理解", "翻译", "作文", "长难句", "听力"],
  政治: ["马克思", "毛概", "思修", "史纲", "哲学", "政治经济学"],
  论文阅读: ["abstract", "method", "experiment", "conclusion", "related work", "摘要", "实验"],
};

function normalizeSubject(subject?: string | null) {
  const value = (subject || "").trim();
  if (!value) return "未分类";

  const lower = value.toLowerCase();
  const aliases: Record<string, string> = {
    "cs": "计算机",
    "computer network": "计算机网络",
    "network": "计算机网络",
    "os": "操作系统",
    "db": "数据库",
    "database": "数据库",
    "math": "高等数学",
    "ai": "人工智能",
    "ml": "机器学习",
    "frontend": "前端开发",
    "backend": "后端开发",
  };

  return aliases[lower] || value;
}

function getText(input: SubjectClassificationInput) {
  return [
    input.title,
    input.summary || "",
    ...(input.tags || []),
    ...(input.themes || []).map((theme) => theme.name),
    input.content,
  ]
    .join("\n")
    .toLowerCase();
}

function classifyByRules(input: SubjectClassificationInput): SubjectClassificationResult | null {
  const text = getText(input);
  const scores = Object.entries(SUBJECT_KEYWORDS).map(([subject, keywords]) => {
    const matched = keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
    return { subject, matched, score: matched.length };
  });

  const best = scores.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score === 0) return null;

  const confidence = Math.min(0.55 + best.score * 0.1, 0.95);
  return {
    subject: best.subject,
    confidence,
    reason: `命中科目关键词：${best.matched.join("、")}`,
    matchedKeywords: best.matched,
    alternativeSubjects: scores
      .filter((item) => item.subject !== best.subject && item.score > 0)
      .slice(0, 3)
      .map((item) => ({
        subject: item.subject,
        confidence: Math.min(0.45 + item.score * 0.08, 0.8),
      })),
    source: "rule",
  };
}

async function getUserSubjectCandidates(userId?: string, client?: SupabaseClient) {
  if (!userId) return DEFAULT_SUBJECTS;

  const db = client || getApiClient();
  const { data } = await db
    .from("user_skills")
    .select("subject_levels")
    .eq("user_id", userId)
    .single();

  const userSubjects = ((data?.subject_levels as UserSubjectLevel[] | null) || [])
    .map((item) => item?.subject)
    .filter(Boolean);

  return [...new Set([...userSubjects, ...DEFAULT_SUBJECTS])];
}

async function classifyByLLM(
  input: SubjectClassificationInput,
  candidates: string[]
): Promise<SubjectClassificationResult | null> {
  const content = input.content.length > 5000 ? `${input.content.slice(0, 5000)}...` : input.content;
  const llm = createLLMClient({ userId: input.userId });

  const prompt = `请把下面学习笔记归类到最合适的科目。只返回 JSON，不要包含 Markdown。

候选科目：${candidates.join("、")}

笔记标题：${input.title}
已有摘要：${input.summary || "无"}
已有标签：${(input.tags || []).join("、") || "无"}
正文片段：
${content}

返回格式：
{
  "subject": "科目名称",
  "confidence": 0.0,
  "reason": "分类理由",
  "matchedKeywords": ["关键词1"],
  "alternativeSubjects": [{"subject": "候选科目", "confidence": 0.0}]
}`;

  try {
    const response = await llm.invoke(
      [
        {
          role: "system",
          content: "你是学习笔记科目分类器，擅长根据标题、正文、标签和用户科目候选做稳定分类。",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.1, maxTokens: 800 }
    );

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      subject: normalizeSubject(parsed.subject),
      confidence: Math.max(0, Math.min(Number(parsed.confidence) || 0, 1)),
      reason: String(parsed.reason || "由大模型根据语义判断。"),
      matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords.map(String) : [],
      alternativeSubjects: Array.isArray(parsed.alternativeSubjects)
        ? parsed.alternativeSubjects.slice(0, 3).map((item: ParsedAlternativeSubject) => ({
            subject: normalizeSubject(item.subject),
            confidence: Math.max(0, Math.min(Number(item.confidence) || 0, 1)),
          }))
        : [],
      source: "llm",
    };
  } catch (error) {
    console.error("Subject classification LLM failed:", error);
    return null;
  }
}

export async function classifySubject(
  input: SubjectClassificationInput,
  client?: SupabaseClient
): Promise<SubjectClassificationResult> {
  const candidates = [
    ...new Set([...(input.subjectCandidates || []), ...(await getUserSubjectCandidates(input.userId, client))]),
  ].map(normalizeSubject);

  const ruleResult = classifyByRules(input);
  if (ruleResult && ruleResult.confidence >= 0.75) {
    return ruleResult;
  }

  const llmResult = await classifyByLLM(input, candidates);
  if (llmResult && llmResult.confidence >= (ruleResult?.confidence || 0)) {
    return llmResult;
  }

  if (ruleResult) return ruleResult;

  return {
    subject: "未分类",
    confidence: 0,
    reason: "未命中明确科目关键词，且大模型分类不可用或置信度不足。",
    matchedKeywords: [],
    alternativeSubjects: [],
    source: "fallback",
  };
}

export async function classifyAndUpdateNote(
  note: NoteForClassification,
  options?: {
    client?: SupabaseClient;
    userId?: string;
    force?: boolean;
    intent?: string;
  }
) {
  const client = options?.client || getApiClient();
  const userId = options?.userId || note.user_id;

  if (!options?.force && note.classification_source === "manual" && note.subject) {
    return {
      subject: note.subject,
      confidence: Number(note.subject_confidence || 1),
      reason: note.subject_reason || "用户手动指定科目。",
      matchedKeywords: [],
      alternativeSubjects: [],
      source: "manual" as const,
    };
  }

  const result = await classifySubject(
    {
      userId,
      noteId: note.id,
      title: note.title || "",
      content: note.content || "",
      summary: note.summary,
      tags: note.tags || [],
      themes: note.themes || [],
      intent: options?.intent || "classify",
    } as SubjectClassificationInput,
    client
  );

  const source = result.confidence >= 0.45 ? result.source : "fallback";

  await client
    .from("notes")
    .update({
      subject: result.subject,
      subject_confidence: result.confidence,
      subject_reason: result.reason,
      classified_at: new Date().toISOString(),
      classification_source: source,
      updated_at: new Date().toISOString(),
    })
    .eq("id", note.id);

  if (userId) {
    await client
      .from("skill_runs")
      .insert({
        user_id: userId,
        note_id: note.id,
        skill_id: "subject-classification",
        intent: options?.intent || "classify",
        input: { title: note.title, tags: note.tags },
        output: result,
        status: "completed",
        confidence: result.confidence,
        created_at: new Date().toISOString(),
      })
      .then(undefined, () => {});
  }

  return result;
}

export async function classifyNoteById(
  noteId: string,
  options?: {
    client?: SupabaseClient;
    userId?: string;
    force?: boolean;
  }
) {
  const client = options?.client || getApiClient();
  let query = client.from("notes").select("*").eq("id", noteId);

  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }

  const { data: note, error } = await query.single();
  if (error || !note) {
    throw new Error("Note not found");
  }

  return classifyAndUpdateNote(note, {
    client,
    userId: options?.userId,
    force: options?.force,
    intent: "classify_note_subject",
  });
}
