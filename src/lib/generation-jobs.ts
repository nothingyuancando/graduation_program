import type { SupabaseClient } from "@supabase/supabase-js";
import { createLLMClient } from "./llm-provider.ts";
import { getApiClient } from "../storage/database/supabase-client.ts";

export type GenerationJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type GenerationJobStage =
  | "queued"
  | "preparing_chunks"
  | "analyzing_chunks"
  | "merging_analysis"
  | "generating_note"
  | "saving_note"
  | "completed"
  | "failed";

type SourceFile = {
  id: string;
  original_file_name: string;
  category?: string | null;
  extracted_text?: string | null;
};

type SourceChunk = {
  text: string;
  sourceFiles: string[];
};

type ChunkAnalysis = {
  chunkIndex: number;
  sourceFiles: string[];
  title?: string;
  summary: string;
  sections: Array<{ title: string; details: string[]; sourceFiles?: string[] }>;
  keyPoints: Array<{ point: string; evidence?: string; sourceFile?: string; confidence?: number }>;
  terms: Array<{ term: string; explanation: string; source?: string }>;
  flashcards: Array<{ question: string; answer: string; difficulty?: number }>;
};

type GenerationJobRow = {
  id: string;
  user_id: string;
  session_id: string;
  note_id?: string | null;
  status: GenerationJobStatus;
  stage: GenerationJobStage;
  progress: number;
  total_chunks: number;
  processed_chunks: number;
  failed_chunks: number;
  error_message?: string | null;
};

type GenerationJobChunkRow = {
  id: string;
  job_id: string;
  chunk_index: number;
  source_file_names?: string[] | null;
  chunk_text: string;
  status: string;
  analysis_json?: unknown;
  error_message?: string | null;
  attempt_count?: number | null;
  created_at?: string;
  updated_at?: string;
};

const CHUNK_TARGET_CHARS = Number(process.env.GENERATION_CHUNK_TARGET_CHARS || 5000);
const CHUNK_ANALYSIS_MAX_TOKENS = Number(process.env.GENERATION_CHUNK_MAX_TOKENS || 1600);
const FINAL_NOTE_MAX_TOKENS = Number(process.env.GENERATION_FINAL_MAX_TOKENS || 4096);
const MAX_CHUNK_ATTEMPTS = Number(process.env.GENERATION_MAX_CHUNK_ATTEMPTS || 3);
const WORKER_IDLE_MS = Number(process.env.GENERATION_WORKER_IDLE_MS || 2500);
const CHUNK_CONCURRENCY = Math.max(1, Math.min(Number(process.env.GENERATION_CHUNK_CONCURRENCY || 3), 8));
const RETRY_BASE_DELAY_MS = Number(process.env.GENERATION_RETRY_BASE_DELAY_MS || 30000);
const RETRY_MAX_DELAY_MS = Number(process.env.GENERATION_RETRY_MAX_DELAY_MS || 5 * 60 * 1000);

function now() {
  return new Date().toISOString();
}

function futureIso(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function compactText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function sanitizeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [hidden]")
    .replace(/\bsk-[A-Za-z0-9._-]{12,}\b/g, "sk-[hidden]")
    .slice(0, 1800);
}

function getRetryDelayMs(attemptCount: number) {
  const delay = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptCount - 1);
  return Math.min(delay, RETRY_MAX_DELAY_MS);
}

function fileName(file: Pick<SourceFile, "original_file_name">) {
  return file.original_file_name || "未命名文件";
}

function isMeaningfulText(text?: string | null) {
  if (!text) return false;
  const value = compactText(text);
  if (value.length < 30) return false;
  if (/^\[(音频文件|视频文件|压缩包|文件|本地文件|Word 97-2003 文件)/u.test(value)) return false;
  return /[\u4e00-\u9fa5a-zA-Z0-9]/u.test(value);
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

function formatSourceFile(file: SourceFile) {
  return [
    `【文件：${fileName(file)}】`,
    `类型：${file.category || "unknown"}`,
    "内容：",
    file.extracted_text || "（无可用文本）",
  ].join("\n");
}

function buildSourceChunks(files: SourceFile[], maxChars = CHUNK_TARGET_CHARS): SourceChunk[] {
  const chunks: SourceChunk[] = [];

  for (const file of files) {
    const formatted = formatSourceFile(file);
    const name = fileName(file);

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
      last.text += `\n\n${"=".repeat(32)}\n\n${formatted}`;
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
  } catch {
    return fallback;
  }
}

function fallbackChunkAnalysis(index: number, chunk: SourceChunk): ChunkAnalysis {
  const details = splitLongText(compactText(chunk.text), 500).slice(0, 10);
  return {
    chunkIndex: index,
    sourceFiles: chunk.sourceFiles,
    title: `资料块 ${index + 1}`,
    summary: compactText(chunk.text).slice(0, 700),
    sections: [
      {
        title: `资料块 ${index + 1}`,
        details,
        sourceFiles: chunk.sourceFiles,
      },
    ],
    keyPoints: details.slice(0, 8).map((detail) => ({
      point: detail.slice(0, 180),
      evidence: detail.slice(0, 180),
      sourceFile: chunk.sourceFiles.join("、"),
      confidence: 0.68,
    })),
    terms: [],
    flashcards: [],
  };
}

async function analyzeChunk(input: {
  userId: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: SourceChunk;
}): Promise<ChunkAnalysis> {
  const fallback = fallbackChunkAnalysis(input.chunkIndex, input.chunk);
  const llm = createLLMClient({ userId: input.userId });
  const prompt = `请分析第 ${input.chunkIndex + 1}/${input.totalChunks} 个学习资料块，为后续生成完整复习笔记保留尽可能多的具体信息。

资料来源：${input.chunk.sourceFiles.join("、")}

资料内容：
${input.chunk.text}

只返回 JSON，不要包裹 Markdown。格式：
{
  "title": "资料块主题",
  "summary": "保真摘要，150-300字",
  "sections": [
    {"title": "主题", "details": ["具体知识点、步骤、结论、例子"], "sourceFiles": ["来源文件名"]}
  ],
  "keyPoints": [
    {"point": "关键知识点", "evidence": "原文证据或事实", "sourceFile": "来源文件名", "confidence": 0.9}
  ],
  "terms": [
    {"term": "概念或术语", "explanation": "定义、作用、上下文", "source": "来源文件名"}
  ],
  "flashcards": [
    {"question": "复习问题", "answer": "答案", "difficulty": 1}
  ]
}

要求：只基于资料内容，不编造；优先保留可复习细节、公式、流程、易错点和例子。`;

  const response = await llm.invoke(
    [
      { role: "system", content: "你是严谨的学习资料分块分析器，输出必须是可解析 JSON。" },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2, maxTokens: CHUNK_ANALYSIS_MAX_TOKENS }
  );

  return {
    ...parseJsonObject<ChunkAnalysis>(response.content, fallback),
    chunkIndex: input.chunkIndex,
    sourceFiles: input.chunk.sourceFiles,
  };
}

function mergeAnalyses(title: string, analyses: ChunkAnalysis[]) {
  const sections = analyses.flatMap((item) => item.sections || []);
  const keyPoints = analyses.flatMap((item) => item.keyPoints || []).slice(0, 120);
  const terms = analyses.flatMap((item) => item.terms || []).slice(0, 80);
  const flashcards = analyses.flatMap((item) => item.flashcards || []).slice(0, 24);
  const themes = sections.slice(0, 20).map((section) => ({
    name: section.title,
    importance: 0.8,
    description: section.details?.slice(0, 2).join("；") || section.title,
  }));

  return {
    title,
    summary: analyses.map((item) => item.summary).filter(Boolean).join("\n").slice(0, 1600),
    sections,
    keyPoints,
    terms,
    flashcards,
    themes,
  };
}

function buildFallbackNote(title: string, files: SourceFile[], analyses: ChunkAnalysis[]) {
  const merged = mergeAnalyses(title, analyses);
  const lines = [
    `# ${title}`,
    "",
    "## 资料来源与覆盖范围",
    ...files.map((file, index) => `${index + 1}. ${fileName(file)}：${compactText(file.extracted_text || "").slice(0, 180)}`),
    "",
    "## 总览",
    merged.summary || "系统已根据可解析文本生成资料整理结果。",
    "",
    "## 核心知识体系",
    ...merged.sections.flatMap((section, index) => [
      `### ${index + 1}. ${section.title}`,
      ...((section.details || []).slice(0, 10).map((detail) => `- ${detail}`)),
      "",
    ]),
    "## 关键概念",
    ...(merged.terms.length
      ? merged.terms.map((item) => `- **${item.term}**：${item.explanation}${item.source ? `（来源：${item.source}）` : ""}`)
      : ["- 暂未提取到稳定概念，请检查上传资料是否包含可解析文本。"]),
    "",
    "## 关键知识点与证据",
    ...merged.keyPoints.map((item, index) => `${index + 1}. ${item.point}${item.evidence ? `\n   - 证据：${item.evidence}` : ""}`),
    "",
    "## 复习卡片",
    ...(merged.flashcards.length
      ? merged.flashcards.map((card, index) => `${index + 1}. Q：${card.question}\n   A：${card.answer}`)
      : merged.keyPoints.slice(0, 12).map((item, index) => `${index + 1}. Q：${item.point}\n   A：参考来源 ${item.sourceFile || "上传资料"} 中的相关说明。`)),
    "",
    "## 总结与后续学习建议",
    "- 先按“核心知识体系”复习主线，再用“关键知识点与证据”回查原始资料。",
    "- 对不熟悉的概念建立单独笔记，并在测验模块中生成练习题巩固。",
  ];

  return lines.join("\n").trim();
}

async function generateFinalNote(input: {
  userId: string;
  title: string;
  files: SourceFile[];
  analyses: ChunkAnalysis[];
}) {
  const fallback = buildFallbackNote(input.title, input.files, input.analyses);
  const merged = mergeAnalyses(input.title, input.analyses);
  const llm = createLLMClient({ userId: input.userId });
  const sourcePreview = input.files
    .map((file) => `【${fileName(file)}】${compactText(file.extracted_text || "").slice(0, 1200)}`)
    .join("\n\n");

  const prompt = `请基于分块分析结果和原始资料摘录，生成一份完整、详细、适合复习的 Markdown 学习笔记。

笔记标题：${input.title}

分块分析结果：
${JSON.stringify(merged, null, 2)}

原始资料摘录：
${sourcePreview}

要求：
1. 直接输出 Markdown，不要代码块。
2. 结构包含：资料来源与覆盖范围、总览、核心知识体系、关键概念/公式/方法、易错点与应用、复习卡片、总结与后续学习建议。
3. 内容要可复习，不要只写大纲。
4. 标注重要内容的来源文件名，不编造资料中没有的信息。`;

  try {
    const response = await llm.invoke(
      [
        { role: "system", content: "你是专业学习笔记整理专家，目标是信息保真和结构化复习。" },
        { role: "user", content: prompt },
      ],
      { temperature: 0.35, maxTokens: FINAL_NOTE_MAX_TOKENS }
    );
    const content = response.content
      .replace(/^```markdown\n?/i, "")
      .replace(/^```\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();
    return content || fallback;
  } catch {
    return fallback;
  }
}

async function getSessionFiles(client: SupabaseClient, sessionId: string, userId?: string) {
  let sessionQuery = client.from("upload_sessions").select("*").eq("id", sessionId);
  if (userId) sessionQuery = sessionQuery.eq("user_id", userId);

  const { data: session, error: sessionError } = await sessionQuery.single();
  if (sessionError || !session) {
    throw new Error("上传会话不存在或无权访问");
  }

  const { data: files, error: filesError } = await client
    .from("file_processing_queue")
    .select("id, original_file_name, category, extracted_text, status")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (filesError) throw new Error(filesError.message);

  const sourceFiles = ((files || []) as SourceFile[]).filter((file) => isMeaningfulText(file.extracted_text));
  if (sourceFiles.length === 0) {
    throw new Error("没有可用于生成笔记的有效文本，请先上传 PDF、Word、TXT、Markdown 或可解析图片。");
  }

  return { session, sourceFiles };
}

export async function createGenerationJob(input: {
  sessionId: string;
  userId: string;
  client?: SupabaseClient;
}) {
  const client = input.client || getApiClient();
  const { sourceFiles } = await getSessionFiles(client, input.sessionId, input.userId);

  const { data: existing } = await client
    .from("generation_jobs")
    .select("*")
    .eq("session_id", input.sessionId)
    .eq("user_id", input.userId)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as GenerationJobRow;

  const chunks = buildSourceChunks(sourceFiles);
  const { data: job, error: jobError } = await client
    .from("generation_jobs")
    .insert({
      user_id: input.userId,
      session_id: input.sessionId,
      status: "pending",
      stage: "queued",
      progress: 0,
      total_chunks: chunks.length,
      processed_chunks: 0,
      failed_chunks: 0,
      model: process.env.LLM_MODEL || null,
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || "创建生成任务失败");
  }

  const chunkRows = chunks.map((chunk, index) => ({
    job_id: job.id,
    chunk_index: index,
    source_file_names: chunk.sourceFiles,
    chunk_text: chunk.text,
    status: "pending",
    attempt_count: 0,
    created_at: now(),
    updated_at: now(),
  }));

  const { error: chunksError } = await client.from("generation_job_chunks").insert(chunkRows);
  if (chunksError) {
    await client.from("generation_jobs").update({
      status: "failed",
      stage: "failed",
      error_message: chunksError.message,
      updated_at: now(),
    }).eq("id", job.id);
    throw new Error(chunksError.message);
  }

  await client
    .from("upload_sessions")
    .update({ status: "processing", updated_at: now() })
    .eq("id", input.sessionId);

  return job as GenerationJobRow;
}

export async function getGenerationJob(input: {
  jobId: string;
  userId?: string;
  client?: SupabaseClient;
}) {
  const client = input.client || getApiClient();
  let query = client.from("generation_jobs").select("*").eq("id", input.jobId);
  if (input.userId) query = query.eq("user_id", input.userId);

  const { data: job, error } = await query.single();
  if (error || !job) throw new Error("生成任务不存在或无权访问");

  const { data: chunks } = await client
    .from("generation_job_chunks")
    .select("id, chunk_index, status, attempt_count, error_message, updated_at")
    .eq("job_id", input.jobId)
    .order("chunk_index", { ascending: true });

  return { job, chunks: chunks || [] };
}

async function updateJobProgress(client: SupabaseClient, jobId: string) {
  const { data: chunks } = await client
    .from("generation_job_chunks")
    .select("status, error_message, analysis_json")
    .eq("job_id", jobId);

  const total = chunks?.length || 0;
  const processed = chunks?.filter((chunk) => chunk.status === "completed").length || 0;
  const failed = chunks?.filter((chunk) => chunk.status === "completed" && !!chunk.error_message).length || 0;
  const pending = chunks?.filter((chunk) => chunk.status === "pending").length || 0;
  const running = chunks?.filter((chunk) => chunk.status === "running").length || 0;
  const progress = total > 0 ? Math.min(90, Math.round((processed / total) * 90)) : 0;

  await client
    .from("generation_jobs")
    .update({
      total_chunks: total,
      processed_chunks: processed,
      failed_chunks: failed,
      progress,
      updated_at: now(),
    })
    .eq("id", jobId);

  return { total, processed, failed, pending, running };
}

async function completeJob(client: SupabaseClient, job: GenerationJobRow) {
  await client.from("generation_jobs").update({
    stage: "merging_analysis",
    progress: 92,
    updated_at: now(),
  }).eq("id", job.id);

  const { session, sourceFiles } = await getSessionFiles(client, job.session_id);
  const { data: chunkRows, error: chunksError } = await client
    .from("generation_job_chunks")
    .select("*")
    .eq("job_id", job.id)
    .order("chunk_index", { ascending: true });

  if (chunksError) throw new Error(chunksError.message);

  const analyses = (chunkRows || []).map((row) => {
    if (row.analysis_json) return row.analysis_json as ChunkAnalysis;
    return fallbackChunkAnalysis(row.chunk_index, {
      text: row.chunk_text,
      sourceFiles: row.source_file_names || [],
    });
  });

  await client.from("generation_jobs").update({
    stage: "generating_note",
    progress: 95,
    updated_at: now(),
  }).eq("id", job.id);

  const noteTitle = session.title || "AI 整理学习笔记";
  const content = await generateFinalNote({
    userId: job.user_id,
    title: noteTitle,
    files: sourceFiles,
    analyses,
  });
  const merged = mergeAnalyses(noteTitle, analyses);

  await client.from("generation_jobs").update({
    stage: "saving_note",
    progress: 98,
    updated_at: now(),
  }).eq("id", job.id);

  const { data: note, error: noteError } = await client
    .from("notes")
    .insert({
      user_id: job.user_id,
      title: noteTitle,
      content,
      content_type: "markdown",
      summary: merged.summary,
      tags: merged.themes.map((theme) => theme.name).slice(0, 12),
      source_type: "mixed",
      session_id: job.session_id,
      status: "organized",
      themes: merged.themes,
      key_points: merged.keyPoints,
      structure: { chapters: merged.sections.map((section) => ({ title: section.title, level: 1, content: section.details?.join("\n") || "" })) },
      entities: { concepts: merged.terms.map((term) => ({ name: term.term, definition: term.explanation, source: term.source })) },
      flashcards: merged.flashcards,
      classification_source: "auto",
      created_at: now(),
      updated_at: now(),
    })
    .select()
    .single();

  if (noteError || !note) throw new Error(noteError?.message || "保存笔记失败");

  await client.from("generation_jobs").update({
    status: "completed",
    stage: "completed",
    progress: 100,
    note_id: note.id,
    updated_at: now(),
  }).eq("id", job.id);

  await client.from("upload_sessions").update({
    status: "completed",
    updated_at: now(),
  }).eq("id", job.session_id);

  await client.from("processing_history").insert({
    session_id: job.session_id,
    note_id: note.id,
    action: "async_organize",
    status: "completed",
    details: {
      jobId: job.id,
      chunksCount: analyses.length,
      generatedContentLength: content.length,
    },
    created_at: now(),
  });
}

async function processChunk(client: SupabaseClient, job: GenerationJobRow, chunk: GenerationJobChunkRow) {
  const attemptCount = Number(chunk.attempt_count || 0) + 1;

  await client.from("generation_job_chunks").update({
    status: "running",
    attempt_count: attemptCount,
    updated_at: now(),
  }).eq("id", chunk.id);

  try {
    const analysis = await analyzeChunk({
      userId: job.user_id,
      chunkIndex: chunk.chunk_index,
      totalChunks: job.total_chunks,
      chunk: {
        text: chunk.chunk_text,
        sourceFiles: chunk.source_file_names || [],
      },
    });

    await client.from("generation_job_chunks").update({
      status: "completed",
      analysis_json: analysis,
      error_message: null,
      updated_at: now(),
    }).eq("id", chunk.id);

    return { status: "completed" as const, chunkId: chunk.id };
  } catch (error) {
    const finalFailure = attemptCount >= MAX_CHUNK_ATTEMPTS;
    const fallbackAnalysis = fallbackChunkAnalysis(chunk.chunk_index, {
      text: chunk.chunk_text,
      sourceFiles: chunk.source_file_names || [],
    });

    await client.from("generation_job_chunks").update({
      status: finalFailure ? "completed" : "pending",
      analysis_json: finalFailure ? fallbackAnalysis : null,
      error_message: sanitizeError(error),
      updated_at: finalFailure ? now() : futureIso(getRetryDelayMs(attemptCount)),
    }).eq("id", chunk.id);

    return {
      status: finalFailure ? "fallback" as const : "retry" as const,
      chunkId: chunk.id,
      error: sanitizeError(error),
    };
  }
}

export async function processNextGenerationJob(client = getApiClient()) {
  const { data: job } = await client
    .from("generation_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) return { processed: false as const, reason: "idle" };
  const currentJob = job as GenerationJobRow;

  try {
    if (currentJob.status === "pending") {
      await client.from("generation_jobs").update({
        status: "running",
        stage: "analyzing_chunks",
        updated_at: now(),
      }).eq("id", currentJob.id);
    }

    const { data: chunks } = await client
      .from("generation_job_chunks")
      .select("*")
      .eq("job_id", currentJob.id)
      .in("status", ["pending"])
      .lte("updated_at", now())
      .order("chunk_index", { ascending: true })
      .limit(CHUNK_CONCURRENCY);

    if (chunks?.length) {
      const results = await Promise.all(chunks.map((chunk) => processChunk(client, currentJob, chunk)));
      await updateJobProgress(client, currentJob.id);
      return {
        processed: true as const,
        jobId: currentJob.id,
        stage: "analyzing_chunks",
        chunks: results.length,
        retries: results.filter((result) => result.status === "retry").length,
        fallbacks: results.filter((result) => result.status === "fallback").length,
      };
    }

    const progress = await updateJobProgress(client, currentJob.id);
    if (progress.total > 0 && progress.processed >= progress.total && progress.running === 0) {
      await completeJob(client, currentJob);
      return { processed: true as const, jobId: currentJob.id, stage: "completed" };
    }

    return { processed: false as const, reason: "waiting", jobId: currentJob.id };
  } catch (error) {
    const message = sanitizeError(error);
    await client.from("generation_jobs").update({
      status: "failed",
      stage: "failed",
      error_message: message,
      updated_at: now(),
    }).eq("id", currentJob.id);

    await client.from("processing_history").insert({
      session_id: currentJob.session_id,
      action: "async_organize",
      status: "failed",
      details: { jobId: currentJob.id, error: message },
      created_at: now(),
    });

    return { processed: true as const, jobId: currentJob.id, stage: "failed", error: message };
  }
}

export function getWorkerIdleMs() {
  return WORKER_IDLE_MS;
}
