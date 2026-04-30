import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { createLLMClient } from "@/lib/llm-provider";
import { getUserFromRequest } from "@/lib/auth";
import { classifySubject } from "@/lib/services/subject-classification";

const CHUNK_TARGET_CHARS = 12000;
const FINAL_SOURCE_BUDGET = 90000;
const CHUNK_ANALYSIS_MAX_TOKENS = 7000;
const MERGED_ANALYSIS_MAX_TOKENS = 9000;
const FINAL_NOTE_MAX_TOKENS = 16000;

type SourceFile = {
  id?: string;
  original_file_name?: string;
  category?: string;
  extracted_text?: string | null;
};

type MindMapNode = {
  id: string;
  label: string;
  description?: string;
  type?: "root" | "chapter" | "concept" | "detail" | "example" | "method" | "pitfall";
  children?: MindMapNode[];
};

type KnowledgeEntities = {
  concepts?: Array<{ name: string; definition?: string; importance?: string; source?: string }>;
  formulas?: Array<{ name: string; expression?: string; meaning?: string; usage?: string }>;
  methods?: Array<{ name: string; steps?: string[]; scenario?: string; notes?: string }>;
  pitfalls?: Array<{ name: string; description?: string; correction?: string }>;
  applications?: Array<{ name: string; scenario?: string; value?: string }>;
  numbers?: Array<{ value: string; unit?: string; context?: string; significance?: string }>;
  dates?: Array<{ date: string; event?: string; importance?: string }>;
  persons?: Array<{ name: string; position?: string; relation?: string }>;
  organizations?: Array<{ name: string; type?: string; description?: string }>;
  locations?: Array<{ name: string; type?: string; context?: string }>;
};

type ChunkAnalysis = {
  chunkIndex: number;
  sourceFiles: string[];
  title?: string;
  sections?: Array<{ title: string; details: string[]; sourceFiles?: string[] }>;
  keyPoints?: Array<{ point: string; evidence?: string; sourceQuote?: string; sourceFile?: string; confidence?: number }>;
  terms?: Array<{ term: string; explanation: string; source?: string }>;
  formulas?: KnowledgeEntities["formulas"];
  methods?: KnowledgeEntities["methods"];
  pitfalls?: KnowledgeEntities["pitfalls"];
  applications?: KnowledgeEntities["applications"];
  tasks?: Array<Record<string, unknown>>;
  flashcards?: Array<Record<string, unknown>>;
  comparisons?: Array<Record<string, unknown>>;
  timeline?: Array<Record<string, unknown>>;
  summary?: string;
};

type MergedAnalysis = {
  suggestedTitle: string;
  themes: Array<{ name: string; importance: number; description?: string }>;
  keyPoints: Array<{ point: string; sourceQuote?: string; evidence?: string; confidence?: number }>;
  summary: string;
  structure: { chapters: Array<{ title: string; level: number; content: string; subChapters?: Array<Record<string, unknown>> }> };
  entities: KnowledgeEntities;
  tasks: Array<Record<string, unknown>>;
  mindMap: MindMapNode;
  flashcards: Array<Record<string, unknown>>;
  timeline: Array<Record<string, unknown>>;
  comparisons: Array<Record<string, unknown>>;
};

type WeakConcept = {
  concept?: string;
};

function textLength(files: SourceFile[]) {
  return files.reduce((sum, file) => sum + (file.extracted_text || "").length, 0);
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function isUnsupportedExtraction(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;

  return [
    /^\[(音频文件|视频文件|压缩包|本地文件|文件|Word 97-2003 文件)[^\]]*(暂不支持|请解压|需配置对象存储|无法处理)[^\]]*\]$/u,
    /^(（无法提取内容）|\(无法提取内容\))$/u,
  ].some((pattern) => pattern.test(trimmed));
}

function isMeaningfulExtractedText(text?: string | null) {
  if (!text) return false;

  const compacted = compactText(text);
  if (isUnsupportedExtraction(compacted)) return false;
  if (compacted.length < 30) return false;

  return /[\u4e00-\u9fa5a-zA-Z0-9]/u.test(compacted);
}

function sourceCorpus(files: SourceFile[]) {
  return compactText(files.map((file) => file.extracted_text || "").join(" "));
}

function sourceSnippets(files: SourceFile[], limit = 18) {
  return files
    .flatMap((file) => splitLongText(compactText(file.extracted_text || ""), 180))
    .map((snippet) => snippet.slice(0, 80).trim())
    .filter((snippet) => snippet.length >= 18)
    .slice(0, limit);
}

function hasSourceTrace(content: string, files: SourceFile[]) {
  const compactedContent = compactText(content);
  if (!compactedContent) return false;

  const fileNames = files.map(fileName).filter((name) => name && name !== "未命名文件");
  if (fileNames.some((name) => compactedContent.includes(name))) return true;

  return sourceSnippets(files, 12).some((snippet) => compactedContent.includes(snippet.slice(0, 24)));
}

function includesGenericPlaceholder(value?: string | null) {
  if (!value) return true;
  return [
    "关键知识点",
    "证据或来源说明",
    "概念名",
    "术语",
    "定义/作用/上下文",
    "来源文件名",
    "复习问题",
    "答案",
    "章节/主题",
    "未命名文件",
  ].some((placeholder) => value.includes(placeholder));
}

function quoteAppearsInSource(corpus: string, quote?: string) {
  if (!quote) return false;
  const compactedQuote = compactText(quote);
  if (compactedQuote.length < 6) return false;
  return corpus.includes(compactedQuote) || corpus.includes(compactedQuote.slice(0, 24));
}

function fileName(file: SourceFile) {
  return file.original_file_name || "未命名文件";
}

function formatSourceFile(file: SourceFile) {
  return [`【文件：${fileName(file)}】`, `类型：${file.category || "unknown"}`, "内容：", file.extracted_text || "（无法提取内容）"].join("\n");
}

function splitLongText(text: string, maxChars: number) {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChars) {
    const preferredBreak = Math.max(
      remaining.lastIndexOf("\n\n", maxChars),
      remaining.lastIndexOf("\n# ", maxChars),
      remaining.lastIndexOf("。", maxChars),
      remaining.lastIndexOf("；", maxChars)
    );
    const splitAt = preferredBreak > maxChars * 0.55 ? preferredBreak + 1 : maxChars;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

function buildSourceChunks(files: SourceFile[], maxChars = CHUNK_TARGET_CHARS) {
  const chunks: Array<{ text: string; sourceFiles: string[] }> = [];

  for (const file of files) {
    const name = fileName(file);
    const formatted = formatSourceFile(file);

    if (formatted.length > maxChars) {
      splitLongText(formatted, maxChars).forEach((part, index, parts) => {
        chunks.push({
          text: `${part}\n\n（${name} 的第 ${index + 1}/${parts.length} 段）`,
          sourceFiles: [name],
        });
      });
      continue;
    }

    const last = chunks[chunks.length - 1];
    if (last && last.text.length + formatted.length + 8 <= maxChars) {
      last.text += `\n\n${"=".repeat(40)}\n\n${formatted}`;
      last.sourceFiles.push(name);
    } else {
      chunks.push({ text: formatted, sourceFiles: [name] });
    }
  }

  return chunks;
}

function parseJsonObject<T>(content: string, fallback: T): T {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as T;
  } catch (error) {
    console.error("Failed to parse LLM JSON:", error);
    return fallback;
  }
}

function flatten<T>(items: Array<T[] | undefined>, limit: number): T[] {
  return items.flatMap((item) => item || []).slice(0, limit);
}

function safeId(prefix: string, text: string, index: number) {
  const slug = text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${prefix}-${index}-${slug || "node"}`;
}

function detailNodes(details: string[] | undefined, parentPrefix: string): MindMapNode[] {
  return (details || []).slice(0, 6).map((detail, index) => ({
    id: safeId(parentPrefix, detail, index + 1),
    label: detail.length > 32 ? `${detail.slice(0, 32)}...` : detail,
    description: detail,
    type: "detail",
  }));
}

function buildMindMapFromSections(title: string, sections: ChunkAnalysis["sections"] = []): MindMapNode {
  return {
    id: "root",
    label: title,
    description: "根据上传资料自动生成的知识结构",
    type: "root",
    children: sections.slice(0, 14).map((section, index) => ({
      id: safeId("chapter", section.title, index + 1),
      label: section.title,
      description: section.sourceFiles?.length ? `来源：${section.sourceFiles.join("、")}` : section.details?.[0],
      type: "chapter",
      children: [
        {
          id: safeId("concept", section.title, index + 1),
          label: "核心要点",
          description: "本主题最需要掌握的内容",
          type: "concept",
          children: detailNodes(section.details, `detail-${index + 1}`),
        },
      ],
    })),
  };
}

function buildFallbackAnalysis(sessionTitle: string, chunkAnalyses: ChunkAnalysis[]): MergedAnalysis {
  const sections = flatten(chunkAnalyses.map((item) => item.sections), 80);
  const keyPoints = flatten(chunkAnalyses.map((item) => item.keyPoints), 160).map((item) => ({
    point: item.point,
    sourceQuote: item.sourceQuote || item.evidence || item.sourceFile,
    confidence: item.confidence || 0.82,
  }));
  const terms = flatten(chunkAnalyses.map((item) => item.terms), 140);
  const formulas = flatten(chunkAnalyses.map((item) => item.formulas), 60);
  const methods = flatten(chunkAnalyses.map((item) => item.methods), 60);
  const pitfalls = flatten(chunkAnalyses.map((item) => item.pitfalls), 60);
  const applications = flatten(chunkAnalyses.map((item) => item.applications), 60);

  return {
    suggestedTitle: sessionTitle,
    themes: sections.slice(0, 20).map((section) => ({
      name: section.title,
      importance: 0.8,
      description: section.details?.slice(0, 3).join("；") || section.title,
    })),
    keyPoints,
    summary: chunkAnalyses
      .map((item) => item.summary)
      .filter(Boolean)
      .join("；")
      .slice(0, 900),
    structure: {
      chapters: sections.map((section) => ({
        title: section.title,
        level: 1,
        content: section.details?.join("\n") || "",
        subChapters: [],
      })),
    },
    entities: {
      concepts: terms.map((term) => ({
        name: term.term,
        definition: term.explanation,
        source: term.source,
        importance: "medium",
      })),
      formulas,
      methods,
      pitfalls,
      applications,
      numbers: [],
      dates: [],
      persons: [],
      organizations: [],
      locations: [],
    },
    tasks: flatten(chunkAnalyses.map((item) => item.tasks), 40),
    mindMap: buildMindMapFromSections(sessionTitle, sections),
    flashcards: flatten(chunkAnalyses.map((item) => item.flashcards), 24),
    timeline: flatten(chunkAnalyses.map((item) => item.timeline), 60),
    comparisons: flatten(chunkAnalyses.map((item) => item.comparisons), 24),
  };
}

function expectedMinChars(totalTextLength: number) {
  if (totalTextLength > 80000) return 6500;
  if (totalTextLength > 40000) return 4800;
  if (totalTextLength > 18000) return 3200;
  if (totalTextLength > 8000) return 2200;
  return 1200;
}

function buildSourceExcerpt(sourceChunks: Array<{ text: string; sourceFiles: string[] }>) {
  if (sourceChunks.length === 0) return "";

  const perChunkBudget = Math.max(2500, Math.floor(FINAL_SOURCE_BUDGET / sourceChunks.length));
  return sourceChunks
    .map((chunk, index) => {
      const excerpt = chunk.text.length > perChunkBudget ? `${chunk.text.slice(0, perChunkBudget)}\n（本资料块已截取，完整信息已在分块分析中保留）` : chunk.text;
      return `【资料块 ${index + 1}，来源：${chunk.sourceFiles.join("、")}】\n${excerpt}`;
    })
    .join(`\n\n${"=".repeat(36)}\n\n`);
}

function buildCoverageAppendix(analysis: MergedAnalysis, chunkAnalyses: ChunkAnalysis[], minChars: number) {
  const sections = flatten(chunkAnalyses.map((item) => item.sections), 80);
  const keyPoints = analysis.keyPoints || [];
  const concepts = analysis.entities?.concepts || [];
  const methods = analysis.entities?.methods || [];
  const pitfalls = analysis.entities?.pitfalls || [];
  const formulas = analysis.entities?.formulas || [];

  const lines = [
    "\n\n---",
    "\n\n## 覆盖性复习附录",
    "\n模型初稿篇幅偏短，系统已根据分块分析自动补充以下可复习细节，避免上传资料被过度压缩。",
    "\n### 分块主题与细节",
    ...sections.slice(0, 40).map((section, index) => {
      const details = (section.details || []).slice(0, 6).map((detail) => `  - ${detail}`).join("\n");
      return `${index + 1}. ${section.title}${section.sourceFiles?.length ? `（来源：${section.sourceFiles.join("、")}）` : ""}\n${details}`;
    }),
    "\n### 关键知识点",
    ...keyPoints.slice(0, 60).map((item, index) => `${index + 1}. ${item.point}${item.sourceQuote ? `（依据：${item.sourceQuote}）` : ""}`),
    "\n### 概念、公式与方法",
    ...concepts.slice(0, 40).map((item, index) => `${index + 1}. ${item.name}：${item.definition || "需结合原资料复习"}${item.source ? `（来源：${item.source}）` : ""}`),
    ...formulas.slice(0, 20).map((item, index) => `${index + 1}. ${item.name}：${item.expression || ""}。${item.meaning || ""}${item.usage ? ` 使用场景：${item.usage}` : ""}`),
    ...methods.slice(0, 30).map((item, index) => `${index + 1}. ${item.name}：${(item.steps || []).join(" -> ")}${item.scenario ? `。适用：${item.scenario}` : ""}${item.notes ? `。注意：${item.notes}` : ""}`),
    "\n### 易错点与应用",
    ...pitfalls.slice(0, 30).map((item, index) => `${index + 1}. ${item.name}：${item.description || ""}${item.correction ? ` 修正：${item.correction}` : ""}`),
  ];

  let appendix = lines.filter(Boolean).join("\n");
  if (appendix.length > minChars * 1.5) {
    appendix = appendix.slice(0, Math.max(minChars, 9000));
  }
  return appendix;
}

function sanitizeMergedAnalysis(analysis: MergedAnalysis, files: SourceFile[]) {
  const corpus = sourceCorpus(files);
  const keyPoints = (analysis.keyPoints || []).filter((item) => {
    const point = String(item.point || "").trim();
    const quote = String(item.sourceQuote || item.evidence || "").trim();
    if (!point || includesGenericPlaceholder(point) || includesGenericPlaceholder(quote)) return false;
    return quoteAppearsInSource(corpus, quote);
  });

  return {
    ...analysis,
    keyPoints,
    themes: (analysis.themes || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
    entities: {
      ...analysis.entities,
      concepts: (analysis.entities?.concepts || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
      formulas: (analysis.entities?.formulas || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
      methods: (analysis.entities?.methods || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
      pitfalls: (analysis.entities?.pitfalls || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
      applications: (analysis.entities?.applications || []).filter((item) => item.name && !includesGenericPlaceholder(item.name)),
    },
  };
}

function buildGroundedFallbackNote(title: string, files: SourceFile[], analysis: MergedAnalysis, chunkAnalyses: ChunkAnalysis[]) {
  const sections = flatten(chunkAnalyses.map((item) => item.sections), 80);
  const concepts = analysis.entities?.concepts || [];
  const keyPoints = analysis.keyPoints || [];

  const lines = [
    `# ${title}`,
    "",
    "## 资料来源与覆盖范围",
    ...files.map((file, index) => `${index + 1}. ${fileName(file)}：${compactText(file.extracted_text || "").slice(0, 180)}`),
    "",
    "## 核心知识体系",
    ...(sections.length
      ? sections.slice(0, 40).flatMap((section, index) => [
          `### ${index + 1}. ${section.title}`,
          ...((section.details || []).slice(0, 8).map((detail) => `- ${detail}`)),
          "",
        ])
      : sourceSnippets(files, 30).map((snippet) => `- ${snippet}`)),
    "",
    "## 关键知识点与原文证据",
    ...(keyPoints.length
      ? keyPoints.slice(0, 40).map((item, index) => `${index + 1}. ${item.point}${item.sourceQuote ? `\n   - 证据：${item.sourceQuote}` : ""}`)
      : sourceSnippets(files, 20).map((snippet, index) => `${index + 1}. ${snippet}`)),
    "",
    "## 相关概念",
    ...(concepts.length
      ? concepts.slice(0, 40).map((item) => `- [[${item.name}]]：${item.definition || "见原文证据"}`)
      : ["- 暂未从资料中提取到稳定概念，请检查上传文件是否包含可解析文本。"]),
    "",
    "## 原文摘录",
    ...files.flatMap((file) => [
      `### ${fileName(file)}`,
      compactText(file.extracted_text || "").slice(0, 2000),
      "",
    ]),
  ];

  return lines.join("\n").trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = (await params).id;
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const client = getApiClient();

    const { data: session, error: sessionError } = await client
      .from("upload_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: files, error: filesError } = await client
      .from("file_processing_queue")
      .select("*")
      .eq("session_id", sessionId)
      .eq("status", "completed")
      .order("created_at", { ascending: true });

    if (filesError || !files || files.length === 0) {
      return NextResponse.json({ error: "No processed files found" }, { status: 400 });
    }

    const allSourceFiles = files as SourceFile[];
    const sourceFiles = allSourceFiles.filter((file) => isMeaningfulExtractedText(file.extracted_text));

    if (sourceFiles.length === 0) {
      await client
        .from("upload_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      await client.from("processing_history").insert({
        session_id: sessionId,
        action: "organize",
        status: "failed",
        details: {
          reason: "没有可用于生成笔记的有效文本",
          filesCount: allSourceFiles.length,
          unsupportedFiles: allSourceFiles.map((file) => ({
            fileName: fileName(file),
            category: file.category || "unknown",
            extractedTextPreview: compactText(file.extracted_text || "").slice(0, 120),
          })),
        },
        created_at: new Date().toISOString(),
      });

      return NextResponse.json(
        {
          error: "没有提取到可用于生成笔记的有效文本。音频、视频、压缩包或未配置对象存储的本地文件不会再被强行生成空笔记，请先上传可解析的文本/PDF/图片，或补充原文内容。",
        },
        { status: 400 }
      );
    }

    const totalTextLength = textLength(sourceFiles);
    const sourceChunks = buildSourceChunks(sourceFiles);
    const minOutputChars = expectedMinChars(totalTextLength);
    const llmClient = createLLMClient({ userId: user.id });

    let profileContext = "";
    const { data: profile } = await client
      .from("user_learning_profiles")
      .select("weak_concepts, interests")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      const weakList = ((profile.weak_concepts as WeakConcept[]) || [])
        .slice(0, 5)
        .map((concept) => concept.concept)
        .filter(Boolean)
        .join("、");
      const interestList = ((profile.interests as string[]) || []).slice(0, 5).join("、");
      if (weakList || interestList) {
        profileContext = "\n\n用户学习画像：";
        if (weakList) profileContext += `\n- 薄弱概念：${weakList}，涉及这些概念时请解释得更细。`;
        if (interestList) profileContext += `\n- 兴趣方向：${interestList}`;
      }
    }

    const chunkAnalyses: ChunkAnalysis[] = [];

    for (let index = 0; index < sourceChunks.length; index++) {
      const chunk = sourceChunks[index];
      const prompt = `你是严谨的资料整理助手。请分析第 ${index + 1}/${sourceChunks.length} 个资料块，为后续生成完整长笔记、详细思维导图和知识要素保留尽可能多的信息。

资料块来源文件：${chunk.sourceFiles.join("、")}

资料块内容：
${chunk.text}

请只返回 JSON，不要包裹 markdown 代码块。字段要求：
{
  "title": "该资料块主题",
  "sourceFiles": ["来源文件名"],
  "sections": [
    {
      "title": "章节/主题",
      "details": ["重要知识点、步骤、结论、数据、例子。每条必须具体，适合直接复习"],
      "sourceFiles": ["来源文件名"]
    }
  ],
  "keyPoints": [
    {"point": "关键知识点", "evidence": "原文短句或事实", "sourceFile": "来源文件名", "confidence": 0.95}
  ],
  "terms": [
    {"term": "概念/术语", "explanation": "定义、作用、上下文", "source": "来源文件名"}
  ],
  "formulas": [
    {"name": "公式或规则名", "expression": "表达式", "meaning": "含义", "usage": "使用场景"}
  ],
  "methods": [
    {"name": "方法/流程名", "steps": ["步骤1", "步骤2"], "scenario": "适用场景", "notes": "注意事项"}
  ],
  "pitfalls": [
    {"name": "易错点", "description": "为什么容易错", "correction": "正确理解或处理方式"}
  ],
  "applications": [
    {"name": "应用/案例", "scenario": "场景", "value": "价值"}
  ],
  "tasks": [],
  "flashcards": [
    {"question": "复习问题", "answer": "答案", "category": "知识点", "difficulty": 1}
  ],
  "timeline": [],
  "comparisons": [],
  "summary": "该资料块的保真概述"
}

要求：
1. 不要只列大纲，必须保留可复习的具体细节。
2. 优先提取概念、公式、方法、流程、易错点、应用场景、重要数字和例子。
3. 只基于资料块内容，不要编造。
4. sections 建议 5-12 个，details 建议每个主题 4-8 条。${profileContext}`;

      const response = await llmClient.invoke(
        [
          {
            role: "system",
            content: "你负责把长资料拆段做信息保真提取。输出必须是可解析 JSON。",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.2, maxTokens: CHUNK_ANALYSIS_MAX_TOKENS }
      );

      const fallback: ChunkAnalysis = {
        chunkIndex: index,
        sourceFiles: chunk.sourceFiles,
        sections: [
          {
            title: `资料块 ${index + 1}`,
            details: splitLongText(chunk.text, 1000).slice(0, 12),
            sourceFiles: chunk.sourceFiles,
          },
        ],
        keyPoints: [],
        terms: [],
        formulas: [],
        methods: [],
        pitfalls: [],
        applications: [],
        tasks: [],
        flashcards: [],
        timeline: [],
        comparisons: [],
        summary: chunk.text.slice(0, 800),
      };

      chunkAnalyses.push({
        ...parseJsonObject<ChunkAnalysis>(response.content, fallback),
        chunkIndex: index,
        sourceFiles: chunk.sourceFiles,
      });
    }

    const fallbackAnalysis = buildFallbackAnalysis(session.title, chunkAnalyses);
    const mergedAnalysisPrompt = `你是毕业设计中的智能笔记整理 Agent。下面是多份上传资料逐块提取后的保真分析结果，请合并为一份结构化分析 JSON。

上传统计：
- 文件数：${sourceFiles.length}
- 原始可提取文本长度：${totalTextLength} 字符
- 分块数：${sourceChunks.length}
- 文件名：${sourceFiles.map(fileName).join("、")}

逐块分析结果：
${JSON.stringify(chunkAnalyses, null, 2)}

请只返回 JSON，不要包裹 markdown。字段：
{
  "suggestedTitle": "清晰具体的笔记标题",
  "themes": [{"name": "主题", "importance": 0.95, "description": "说明"}],
  "keyPoints": [{"point": "关键知识点", "sourceQuote": "证据或来源说明", "confidence": 0.95}],
  "summary": "300-600字总览",
  "structure": {"chapters": [{"title": "章节", "level": 1, "content": "本章覆盖内容", "subChapters": [{"title": "小节", "level": 2, "content": "小节内容"}]}]},
  "entities": {
    "concepts": [{"name": "概念名", "definition": "定义/作用/上下文", "importance": "high|medium|low", "source": "来源"}],
    "formulas": [{"name": "公式名", "expression": "公式", "meaning": "含义", "usage": "使用场景"}],
    "methods": [{"name": "方法名", "steps": ["步骤1", "步骤2"], "scenario": "适用场景", "notes": "注意事项"}],
    "pitfalls": [{"name": "易错点", "description": "错误原因", "correction": "正确做法"}],
    "applications": [{"name": "应用/案例", "scenario": "场景", "value": "价值"}],
    "numbers": [{"value": "数值", "unit": "单位", "context": "上下文", "significance": "意义"}],
    "dates": [],
    "persons": [],
    "organizations": [],
    "locations": []
  },
  "tasks": [],
  "mindMap": {
    "id": "root",
    "label": "中心主题",
    "description": "整体说明",
    "type": "root",
    "children": [
      {
        "id": "chapter-1",
        "label": "一级主题/章节",
        "description": "本分支覆盖什么",
        "type": "chapter",
        "children": [
          {
            "id": "concept-1",
            "label": "核心概念/方法",
            "description": "一句话解释",
            "type": "concept",
            "children": [
              {"id": "detail-1", "label": "关键细节/公式/步骤", "description": "具体说明", "type": "detail"},
              {"id": "example-1", "label": "例子/应用", "description": "来自资料的案例", "type": "example"}
            ]
          }
        ]
      }
    ]
  },
  "flashcards": [],
  "timeline": [],
  "comparisons": []
}

合并要求：
1. mindMap 必须 3-4 层，不少于 24 个节点；每个一级主题下至少 2 个子节点；叶子节点要写具体细节，不要只写“概念/总结/应用”。
2. entities 优先填 concepts、formulas、methods、pitfalls、applications，人物地点只在资料确实重要时填写。
3. 主题相近的内容可以合并，但不能丢失重要细节。
4. flashcards 控制在 10-20 个，覆盖核心概念。`;

    const mergedAnalysisResponse = await llmClient.invoke(
      [
        {
          role: "system",
          content: "你负责把多个分块分析结果合并成完整结构化分析。输出必须是 JSON。",
        },
        { role: "user", content: mergedAnalysisPrompt },
      ],
      { temperature: 0.25, maxTokens: MERGED_ANALYSIS_MAX_TOKENS }
    );

    const analysis = sanitizeMergedAnalysis({
      ...fallbackAnalysis,
      ...parseJsonObject<MergedAnalysis>(mergedAnalysisResponse.content, fallbackAnalysis),
    }, sourceFiles);

    if (!analysis.mindMap || !analysis.mindMap.children?.length) {
      analysis.mindMap = buildMindMapFromSections(analysis.suggestedTitle || session.title, flatten(chunkAnalyses.map((item) => item.sections), 80));
    }

    const sourceExcerpt = buildSourceExcerpt(sourceChunks);
    const notePrompt = `请基于“结构化分析”和“原始资料摘录”生成一份完整详细的 Markdown 学习笔记。

## 生成目标
这不是摘要，而是面向复习、查阅、毕业设计展示的系统化长笔记。不要为了简洁而压缩资料。

## 覆盖要求
- 原始可提取文本长度：${totalTextLength} 字符
- 文件数：${sourceFiles.length}
- 分块数：${sourceChunks.length}
- 最低期望篇幅：不少于 ${minOutputChars} 个中文字符
- 必须覆盖每个来源文件，不能只写最前面的文件。
- 对概念、流程、公式、步骤、案例、数字、对比关系和注意事项要展开。
- 如果内容来自不同文件，请在章节或段落中标注来源文件名。
- 可以做合理解释和串联，但不能编造原文没有的信息。

## 结构化分析
${JSON.stringify(analysis, null, 2)}

## 原始资料摘录
${sourceExcerpt}

## Markdown 结构要求
# ${analysis.suggestedTitle || session.title}

## 资料来源与覆盖范围
列出本次整合的文件和各自主要内容。

## 总览
用 2-4 段说明整体主题、学习目标和内容范围。

## 核心知识体系
按主题拆成多个二级/三级章节，每节都要写成可复习的详细说明，不要只列标题。

## 关键概念、公式与方法
整理术语、定义、公式、方法步骤、适用场景和易混点。

## 易错点与应用场景
把资料里的注意事项、误区、案例和应用单独展开。

## 对比与表格
适合对比的内容用 Markdown 表格呈现。

## 复习卡片
生成 10-20 个问答。

## 总结与延伸思考
总结重点，并给出后续学习建议。

请直接输出 Markdown，不要包裹代码块。`;

    const noteResponse = await llmClient.invoke(
      [
        {
          role: "system",
          content: "你是专业的学习笔记整理专家。首要目标是信息保真和结构化展开，禁止把大量资料压缩成短摘要。",
        },
        { role: "user", content: notePrompt },
      ],
      { temperature: 0.42, maxTokens: FINAL_NOTE_MAX_TOKENS }
    );

    let structuredContent = noteResponse.content
      .replace(/^```markdown\n?/i, "")
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    if (structuredContent.length < minOutputChars) {
      structuredContent += buildCoverageAppendix(analysis, chunkAnalyses, minOutputChars - structuredContent.length);
    }

    if (!hasSourceTrace(structuredContent, sourceFiles)) {
      structuredContent = buildGroundedFallbackNote(
        analysis.suggestedTitle || session.title,
        sourceFiles,
        analysis,
        chunkAnalyses
      );
    }

    if (!structuredContent.trim()) {
      return NextResponse.json({ error: "生成笔记失败：有效文本为空，请检查上传文件的解析结果。" }, { status: 400 });
    }

    const generatedTags = (analysis.themes as Array<{ name: string }> | undefined)?.map((theme) => theme.name) || [];
    const subjectClassification = await classifySubject(
      {
        userId: user.id,
        title: analysis.suggestedTitle || session.title,
        content: structuredContent,
        summary: analysis.summary,
        tags: generatedTags,
        themes: analysis.themes || [],
      },
      client
    ).catch((error) => {
      console.error("Failed to classify consolidated note:", error);
      return null;
    });

    const { data: note, error: noteError } = await client
      .from("notes")
      .insert({
        user_id: user.id,
        title: analysis.suggestedTitle || session.title,
        content: structuredContent,
        content_type: "markdown",
        summary: analysis.summary,
        tags: generatedTags,
        subject: subjectClassification?.subject || "未分类",
        subject_confidence: subjectClassification?.confidence || 0,
        subject_reason: subjectClassification?.reason || "未完成自动分类。",
        classified_at: new Date().toISOString(),
        classification_source: subjectClassification?.source || "fallback",
        source_type: "mixed",
        session_id: sessionId,
        status: "organized",
        themes: analysis.themes,
        key_points: analysis.keyPoints,
        structure: analysis.structure,
        entities: analysis.entities,
        tasks: analysis.tasks,
        timeline: analysis.timeline || [],
        mind_map: analysis.mindMap,
        flashcards: analysis.flashcards,
        comparisons: analysis.comparisons,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (noteError) {
      console.error("Error creating note:", noteError);
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }

    await client
      .from("upload_sessions")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    await client.from("processing_history").insert({
      session_id: sessionId,
      note_id: note.id,
      action: "organize",
      status: "completed",
      details: {
        filesCount: sourceFiles.length,
        totalTextLength,
        chunksCount: sourceChunks.length,
        expectedMinChars: minOutputChars,
        generatedContentLength: structuredContent.length,
        themesCount: analysis.themes?.length || 0,
        tasksCount: analysis.tasks?.length || 0,
        flashcardsCount: analysis.flashcards?.length || 0,
        hasMindMap: !!analysis.mindMap,
        mindMapNodesCount: JSON.stringify(analysis.mindMap || {}).match(/"id"/g)?.length || 0,
        conceptsCount: analysis.entities?.concepts?.length || 0,
        methodsCount: analysis.entities?.methods?.length || 0,
        pitfallsCount: analysis.entities?.pitfalls?.length || 0,
        comparisonsCount: analysis.comparisons?.length || 0,
        subject: subjectClassification?.subject || "未分类",
        subjectConfidence: subjectClassification?.confidence || 0,
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      note,
      analysis: {
        themes: analysis.themes,
        keyPoints: analysis.keyPoints,
        summary: analysis.summary,
        tasks: analysis.tasks,
        mindMap: analysis.mindMap,
        flashcards: analysis.flashcards,
        timeline: analysis.timeline,
        comparisons: analysis.comparisons,
        entities: analysis.entities,
        subjectClassification,
        coverage: {
          filesCount: sourceFiles.length,
          totalTextLength,
          chunksCount: sourceChunks.length,
          expectedMinChars: minOutputChars,
          generatedContentLength: structuredContent.length,
        },
      },
      message: "笔记已成功生成",
    });
  } catch (error) {
    console.error("Error consolidating content:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
