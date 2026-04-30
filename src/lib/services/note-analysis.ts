import { SupabaseClient } from "@supabase/supabase-js";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";
import { formatSkillContextForPrompt } from "@/lib/services/skill-profile";
import { classifyNoteById } from "@/lib/services/subject-classification";

interface AnalyzeNoteOptions {
  client?: SupabaseClient;
  userId?: string;
  origin?: string;
  cookie?: string;
}

type WeakConcept = {
  concept?: string;
};

type AnalysisResult = {
  summary: string;
  tags: string[];
  entities: Array<{ type: string; name: string; description?: string }>;
  keyPoints: Array<{ point: string; sourceQuote: string; confidence: number }>;
};

const GENERIC_PLACEHOLDER_PATTERNS = [
  "标签1",
  "标签2",
  "标签3",
  "实体名称",
  "知识点描述",
  "必须来自原文",
  "原文引用",
  "示例",
  "概念名",
  "关键知识点",
];

function parseAnalysisJson(content: string): AnalysisResult | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as AnalysisResult;
  } catch (error) {
    console.error("Failed to parse LLM analysis JSON:", error);
    return null;
  }
}

function includesGenericPlaceholder(value: string) {
  return GENERIC_PLACEHOLDER_PATTERNS.some((pattern) => value.includes(pattern));
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function quoteAppearsInSource(source: string, quote: string) {
  const normalizedSource = compactWhitespace(source);
  const normalizedQuote = compactWhitespace(quote);
  if (!normalizedQuote) return false;
  if (normalizedSource.includes(normalizedQuote)) return true;

  // OCR/PDF extraction may insert spaces or line breaks. Require a meaningful overlap.
  return normalizedQuote.length >= 12 && normalizedSource.includes(normalizedQuote.slice(0, 12));
}

function sanitizeAnalysis(raw: AnalysisResult | null, sourceContent: string): AnalysisResult {
  if (!raw) {
    return {
      summary: "AI 分析失败：模型未返回可解析的结构化结果。",
      tags: [],
      entities: [],
      keyPoints: [],
    };
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(String).map((tag) => tag.trim()).filter((tag) => tag && !includesGenericPlaceholder(tag)).slice(0, 8)
    : [];

  const entities = Array.isArray(raw.entities)
    ? raw.entities
        .filter((entity) => entity?.name && !includesGenericPlaceholder(String(entity.name)))
        .map((entity) => ({
          type: String(entity.type || "concept"),
          name: String(entity.name).trim(),
          description: entity.description ? String(entity.description).trim() : "",
        }))
        .slice(0, 30)
    : [];

  const keyPoints = Array.isArray(raw.keyPoints)
    ? raw.keyPoints
        .filter((item) => {
          const point = String(item?.point || "").trim();
          const sourceQuote = String(item?.sourceQuote || "").trim();
          if (!point || !sourceQuote) return false;
          if (includesGenericPlaceholder(point) || includesGenericPlaceholder(sourceQuote)) return false;
          return quoteAppearsInSource(sourceContent, sourceQuote);
        })
        .map((item) => ({
          point: String(item.point).trim(),
          sourceQuote: String(item.sourceQuote).trim(),
          confidence: Math.max(0, Math.min(Number(item.confidence) || 0.75, 1)),
        }))
        .slice(0, 8)
    : [];

  const summary = String(raw.summary || "").trim();

  return {
    summary: summary && !includesGenericPlaceholder(summary) ? summary : sourceContent.slice(0, 180),
    tags,
    entities,
    keyPoints,
  };
}

export async function analyzeNoteById(noteId: string, options?: AnalyzeNoteOptions) {
  const client = options?.client || getApiClient();

  const { data: note, error: noteError } = await client
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    throw new Error("Note not found");
  }

  await client.from("notes").update({ status: "analyzing" }).eq("id", noteId);

  let feedbackContext = "";
  if (options?.userId) {
    const { data: feedbacks } = await client
      .from("knowledge_feedback")
      .select("feedback, original_value, corrected_value")
      .eq("user_id", options.userId)
      .in("feedback", ["edited", "incorrect"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (feedbacks?.length) {
      feedbackContext = `\n\n浠ヤ笅鏄敤鎴峰鍘嗗彶鐭ヨ瘑鎻愬彇缁撴灉鐨勪慨姝ｏ紝璇峰弬鑰冭繖浜涘亸濂介伩鍏嶉噸澶嶉敊璇細\n${feedbacks
        .map((feedback) =>
          feedback.feedback === "edited" && feedback.corrected_value
            ? `- 鍘熷锛?${feedback.original_value}" -> 鐢ㄦ埛淇涓猴細"${feedback.corrected_value}"`
            : `- 鍘熷锛?${feedback.original_value}" -> 鐢ㄦ埛鏍囪涓轰笉姝ｇ‘`
        )
        .join("\n")}`;
    }
  }

  let profileContext = "";
  if (options?.userId) {
    const { data: profile } = await client
      .from("user_learning_profiles")
      .select("weak_concepts, interests")
      .eq("user_id", options.userId)
      .single();

    if (profile) {
      const weakList = (profile.weak_concepts as WeakConcept[] | undefined)?.slice(0, 5).map((item) => item.concept).join("、");
      const interestList = (profile.interests as string[] | undefined)?.slice(0, 5).join("、");

      if (weakList || interestList) {
        profileContext = "\n\n用户学习画像：";
        if (weakList) {
          profileContext += `\n- 薄弱概念：${weakList}（涉及这些内容时请给出更细致的解释）`;
        }
        if (interestList) {
          profileContext += `\n- 兴趣领域：${interestList}`;
        }
      }
    }
  }

  // 鑾峰彇鐢ㄦ埛鎶€鑳界敾鍍忎笂涓嬫枃
  let skillContext = "";
  if (options?.userId) {
    try {
      skillContext = await formatSkillContextForPrompt(options.userId, client);
    } catch {
      // skill context is optional
    }
  }

  const llmClient = createLLMClient({ userId: options?.userId });
  const analysisPrompt = `请严格基于下面这篇笔记内容做结构化分析，只允许使用原文中出现的信息，不要引入外部常识，也不要复述示例字段。

笔记标题：${note.title}

笔记原文：
<<<NOTE_CONTENT
${note.content}
NOTE_CONTENT

请只返回可解析 JSON，不要包裹 markdown 代码块。格式如下：
{
  "summary": "用 1-2 句话概括这篇笔记真实讨论的核心内容",
  "tags": ["根据原文生成的标签"],
  "entities": [
    {
      "type": "person|organization|location|concept|formula|method|other",
      "name": "原文中真实出现或明确讨论的实体/概念",
      "description": "结合原文给出的简短解释"
    }
  ],
  "keyPoints": [
    {
      "point": "从原文归纳出的关键知识点",
      "sourceQuote": "必须逐字摘自原文的一小段证据，不要改写",
      "confidence": 0.95
    }
  ]
}

硬性要求：
1. keyPoints 提取 3-8 条，每条必须有 sourceQuote。
2. sourceQuote 必须能在笔记原文中找到，不能编造、不能只写来源说明。
3. 如果原文信息不足，就少提取，不要用通用学习建议填充。
4. 不要输出“标签1”“实体名称”“知识点描述”等模板占位词。
5. 只返回 JSON。${feedbackContext}${profileContext}${skillContext}`;

  const response = await llmClient.invoke(
    [
      {
        role: "system",
        content: "你是专业的知识分析助手，擅长从文本中提取结构化信息。",
      },
      {
        role: "user",
        content: analysisPrompt,
      },
    ],
    { temperature: 0.3 }
  );

  const analysisResult = sanitizeAnalysis(parseAnalysisJson(response.content), note.content || "");

  await client
    .from("notes")
    .update({
      summary: analysisResult.summary,
      tags: analysisResult.tags,
      key_points: analysisResult.keyPoints,
      status: "processed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", noteId);

  await client.from("note_entities").delete().eq("note_id", noteId);

  if (analysisResult.entities.length > 0) {
    await client.from("note_entities").insert(
      analysisResult.entities.map((entity) => ({
        note_id: noteId,
        entity_type: entity.type,
        entity_name: entity.name,
        description: entity.description || "",
        created_at: new Date().toISOString(),
      }))
    );
  }

  const subjectClassification = await classifyNoteById(noteId, {
    client,
    userId: options?.userId,
  }).catch((error) => {
    console.error("Failed to classify note subject:", error);
    return null;
  });

  if (options?.origin && options?.userId) {
    fetch(`${options.origin}/api/notes/${noteId}/related/compute`, {
      method: "POST",
      headers: {
        cookie: options.cookie || "",
      },
    }).catch(() => {});
  }

  return { ...analysisResult, subjectClassification };
}

