import { AnyPgColumn, pgTable, serial, timestamp, text, varchar, integer, jsonb, index, decimal, date, unique, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";

// 系统表（保留）
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ========== 批量上传相关表 ==========

// 上传会话表 - 记录一次批量上传
export const uploadSessions = pgTable(
  "upload_sessions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id"), // 关联 auth.users(id)，FK 在数据库层定义
    title: varchar("title", { length: 500 }).notNull().default("未整理笔记"),
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending/processing/completed/failed
    totalFiles: integer("total_files").notNull().default(0),
    processedFiles: integer("processed_files").notNull().default(0),
    metadata: jsonb("metadata"), // 额外的会话信息
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("upload_sessions_status_idx").on(table.status),
    index("upload_sessions_created_at_idx").on(table.createdAt),
  ]
);

// 文件处理队列表
export const fileProcessingQueue = pgTable(
  "file_processing_queue",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id", { length: 36 }).notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
    originalFileName: varchar("original_file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    fileType: varchar("file_type", { length: 100 }).notNull(), // MIME类型
    category: varchar("category", { length: 50 }), // text/image/presentation/spreadsheet/audio/video/archive
    fileKey: text("file_key"), // 存储在对象存储中的key
    status: varchar("status", { length: 50 }).notNull().default("pending"), // pending/processing/completed/failed
    extractedText: text("extracted_text"), // 提取的文本内容
    metadata: jsonb("metadata"), // 文件元数据
    errorMessage: text("error_message"), // 错误信息
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index("file_queue_session_id_idx").on(table.sessionId),
    index("file_queue_status_idx").on(table.status),
  ]
);

// ========== 笔记相关表 ==========

// 笔记表
export const notes = pgTable(
  "notes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id"), // 关联 auth.users(id)，FK 在数据库层定义
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    contentType: varchar("content_type", { length: 50 }).notNull().default("text"), // text/markdown/html
    summary: text("summary"), // AI生成的摘要
    tags: jsonb("tags").$type<string[]>(), // 标签数组
    subject: varchar("subject", { length: 100 }),
    subjectConfidence: decimal("subject_confidence", { precision: 3, scale: 2 }).default("0.00"),
    subjectReason: text("subject_reason"),
    classifiedAt: timestamp("classified_at", { withTimezone: true, mode: 'string' }),
    classificationSource: varchar("classification_source", { length: 50 }).default("auto"),
    sourceType: varchar("source_type", { length: 50 }).notNull().default("text"), // text/pdf/image/url/audio/video/mixed
    sourceUrl: text("source_url"), // 来源URL或文件路径
    sessionId: varchar("session_id", { length: 36 }).references(() => uploadSessions.id, { onDelete: "set null" }), // 关联上传会话
    status: varchar("status", { length: 50 }).notNull().default("draft"), // draft/processed/analyzing/organized
    // 结构化内容字段
    themes: jsonb("themes").$type<Array<{ name: string; importance: number }>>(), // 主题
    keyPoints: jsonb("key_points").$type<Array<{ point: string; sourceQuote: string; confidence: number }> | string[]>(), // 关键要点（新格式带出处+置信度，兼容旧string[]格式）
    structure: jsonb("structure"), // 结构化内容（章节、层级）
    entities: jsonb("entities"), // 提取的所有实体
    metrics: jsonb("metrics"), // 提取的数字指标
    tasks: jsonb("tasks"), // 提取的任务
    timeline: jsonb("timeline"), // 提取的时间线
    // 新增：辅助学习资料
    mindMap: jsonb("mind_map"), // 思维导图数据
    flashcards: jsonb("flashcards"), // 知识卡片
    comparisons: jsonb("comparisons"), // 对比表格
    // 版本管理
    version: integer("version").notNull().default(1),
    parentNoteId: varchar("parent_note_id", { length: 36 }).references((): AnyPgColumn => notes.id, { onDelete: "set null" }),
    isPublic: boolean("is_public").notNull().default(false),
    forkCount: integer("fork_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notes_status_idx").on(table.status),
    index("notes_subject_idx").on(table.subject),
    index("notes_created_at_idx").on(table.createdAt),
    index("notes_session_id_idx").on(table.sessionId),
  ]
);

// 笔记版本历史表
export const noteVersions = pgTable(
  "note_versions",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    noteId: varchar("note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    tags: jsonb("tags").$type<string[]>(),
    metadata: jsonb("metadata"), // 变更信息
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("note_versions_note_id_idx").on(table.noteId),
    index("note_versions_version_idx").on(table.version),
  ]
);

// 处理历史表
export const processingHistory = pgTable(
  "processing_history",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    noteId: varchar("note_id", { length: 36 }).references(() => notes.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 36 }).references(() => uploadSessions.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 100 }).notNull(), // upload/extract/analyze/clean/organize/export
    status: varchar("status", { length: 50 }).notNull(), // pending/processing/completed/failed
    details: jsonb("details"), // 详细处理信息
    duration: integer("duration"), // 处理时长（毫秒）
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("processing_history_note_id_idx").on(table.noteId),
    index("processing_history_session_id_idx").on(table.sessionId),
    index("processing_history_created_at_idx").on(table.createdAt),
  ]
);

// 实体提取表
export const noteEntities = pgTable(
  "note_entities",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    noteId: varchar("note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // person/organization/location/concept/date/number/task/other
    entityName: varchar("entity_name", { length: 500 }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata"), // 额外的实体信息（如职位、关系等）
    confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.00"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("note_entities_note_id_idx").on(table.noteId),
    index("note_entities_entity_type_idx").on(table.entityType),
  ]
);

// 笔记关系表
export const noteRelationships = pgTable(
  "note_relationships",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fromNoteId: varchar("from_note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    toNoteId: varchar("to_note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    relationshipType: varchar("relationship_type", { length: 50 }).notNull(), // reference/similar/contains/relates_to
    confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull().default("0.00"), // 置信度 0-1
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("note_relationships_from_idx").on(table.fromNoteId),
    index("note_relationships_to_idx").on(table.toNoteId),
  ]
);

// ========== 知识图谱相关表 ==========

// 知识图谱节点
export const knowledgeNodes = pgTable(
  "knowledge_nodes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    type: varchar("type", { length: 50 }).notNull(), // note/entity/concept
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata"), // 存储节点额外信息
    noteId: varchar("note_id", { length: 36 }).references(() => notes.id, { onDelete: "cascade" }), // 如果是note类型
    entityName: varchar("entity_name", { length: 500 }), // 如果是entity类型
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_nodes_type_idx").on(table.type),
    index("knowledge_nodes_note_id_idx").on(table.noteId),
  ]
);

// 知识图谱边
export const knowledgeEdges = pgTable(
  "knowledge_edges",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fromNodeId: varchar("from_node_id", { length: 36 }).notNull().references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    toNodeId: varchar("to_node_id", { length: 36 }).notNull().references(() => knowledgeNodes.id, { onDelete: "cascade" }),
    edgeType: varchar("edge_type", { length: 50 }).notNull(), // 关系类型
    weight: decimal("weight", { precision: 3, scale: 2 }).notNull().default("1.00"), // 边的权重
    metadata: jsonb("metadata"), // 额外的边信息
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_edges_from_idx").on(table.fromNodeId),
    index("knowledge_edges_to_idx").on(table.toNodeId),
  ]
);

// ========== 知识点反馈表 ==========

// 用户对 AI 生成内容的纠错/确认
export const knowledgeFeedback = pgTable(
  "knowledge_feedback",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    noteId: varchar("note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    fieldType: varchar("field_type", { length: 50 }).notNull(), // 'key_point' | 'entity' | 'summary' | 'tag'
    fieldIndex: integer("field_index").notNull().default(0),
    feedback: varchar("feedback", { length: 20 }).notNull(), // 'correct' | 'incorrect' | 'edited'
    originalValue: text("original_value"),
    correctedValue: text("corrected_value"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("knowledge_feedback_user_note_idx").on(table.userId, table.noteId),
    index("knowledge_feedback_user_idx").on(table.userId),
  ]
);

// ========== 用户学习画像表 ==========

export const userLearningProfiles = pgTable(
  "user_learning_profiles",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    weakConcepts: jsonb("weak_concepts").$type<Array<{ concept: string; score: number; lastSeen: string }>>().notNull().default([]),
    strongConcepts: jsonb("strong_concepts").$type<Array<{ concept: string; score: number; lastSeen: string }>>().notNull().default([]),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    studyStats: jsonb("study_stats").$type<{
      totalNotes?: number;
      totalReviews?: number;
      avgConfidence?: number;
      totalFeedback?: number;
    }>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  }
);

// ========== 用户技能画像表 ==========

export const userSkills = pgTable(
  "user_skills",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    subjectLevels: jsonb("subject_levels").$type<Array<{
      subject: string;
      level: "beginner" | "intermediate" | "advanced" | "expert";
      confidence: number;
    }>>().notNull().default([]),
    learningStyle: jsonb("learning_style").$type<{
      preferredFormat: "visual" | "text" | "examples" | "interactive";
      pace: "slow" | "moderate" | "fast";
      detailLevel: "brief" | "moderate" | "detailed";
    }>().notNull().default(sql`'{"preferredFormat":"text","pace":"moderate","detailLevel":"moderate"}'::jsonb`),
    goals: jsonb("goals").$type<Array<{
      goal: string;
      deadline?: string;
      status: "active" | "completed" | "paused";
    }>>().notNull().default([]),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    preferences: jsonb("preferences").$type<{
      language?: string;
      difficultyPreference?: "easy" | "moderate" | "challenging";
      sessionDuration?: number;
    }>().notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_skills_user_id_idx").on(table.userId),
  ]
);

export const skillRuns = pgTable(
  "skill_runs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    noteId: varchar("note_id", { length: 36 }).references(() => notes.id, { onDelete: "cascade" }),
    skillId: varchar("skill_id", { length: 100 }).notNull(),
    intent: varchar("intent", { length: 100 }),
    input: jsonb("input"),
    output: jsonb("output"),
    status: varchar("status", { length: 50 }).notNull().default("completed"),
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("skill_runs_user_id_idx").on(table.userId),
    index("skill_runs_note_id_idx").on(table.noteId),
    index("skill_runs_skill_id_idx").on(table.skillId),
  ]
);

export const userLlmConfigs = pgTable(
  "user_llm_configs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    provider: varchar("provider", { length: 50 }).notNull().default("openai"),
    model: varchar("model", { length: 200 }).notNull().default("gpt-4o-mini"),
    baseUrl: text("base_url"),
    apiKey: text("api_key"),
    temperature: decimal("temperature", { precision: 3, scale: 2 }).notNull().default("0.30"),
    maxTokens: integer("max_tokens").notNull().default(4096),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_llm_configs_user_id_idx").on(table.userId),
    unique("user_llm_configs_user_id_unique").on(table.userId),
  ]
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    sessionId: varchar("session_id", { length: 36 }).notNull().references(() => uploadSessions.id, { onDelete: "cascade" }),
    noteId: varchar("note_id", { length: 36 }).references(() => notes.id, { onDelete: "set null" }),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    stage: varchar("stage", { length: 80 }).notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    totalChunks: integer("total_chunks").notNull().default(0),
    processedChunks: integer("processed_chunks").notNull().default(0),
    failedChunks: integer("failed_chunks").notNull().default(0),
    model: varchar("model", { length: 200 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("generation_jobs_user_id_idx").on(table.userId),
    index("generation_jobs_session_id_idx").on(table.sessionId),
    index("generation_jobs_status_idx").on(table.status),
    index("generation_jobs_created_at_idx").on(table.createdAt),
  ]
);

export const generationJobChunks = pgTable(
  "generation_job_chunks",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    jobId: varchar("job_id", { length: 36 }).notNull().references(() => generationJobs.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    sourceFileNames: text("source_file_names").array().notNull().default(sql`'{}'::text[]`),
    chunkText: text("chunk_text").notNull(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    analysisJson: jsonb("analysis_json"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("generation_job_chunks_job_id_idx").on(table.jobId),
    index("generation_job_chunks_status_idx").on(table.status),
    index("generation_job_chunks_job_status_idx").on(table.jobId, table.status),
    unique("generation_job_chunks_job_index_unique").on(table.jobId, table.chunkIndex),
  ]
);

// ========== Zod Schemas ==========

const { createInsertSchema: createCoercedInsertSchema } = createSchemaFactory({
  coerce: { date: true },
});

// Notes schemas
export const insertNoteSchema = createCoercedInsertSchema(notes).pick({
  title: true,
  content: true,
  contentType: true,
  subject: true,
  sourceType: true,
  sourceUrl: true,
  status: true,
});

export const updateNoteSchema = createCoercedInsertSchema(notes)
  .pick({
    title: true,
    content: true,
    contentType: true,
    summary: true,
    tags: true,
    subject: true,
    status: true,
    isPublic: true,
  })
  .partial();

// Note entities schemas
export const insertNoteEntitySchema = createCoercedInsertSchema(noteEntities).pick({
  noteId: true,
  entityType: true,
  entityName: true,
  description: true,
  metadata: true,
});

// Note relationships schemas
export const insertNoteRelationshipSchema = createCoercedInsertSchema(noteRelationships).pick({
  fromNoteId: true,
  toNoteId: true,
  relationshipType: true,
  confidence: true,
});

// Knowledge nodes schemas
export const insertKnowledgeNodeSchema = createCoercedInsertSchema(knowledgeNodes).pick({
  type: true,
  title: true,
  description: true,
  metadata: true,
  noteId: true,
  entityName: true,
});

// Knowledge edges schemas
export const insertKnowledgeEdgeSchema = createCoercedInsertSchema(knowledgeEdges).pick({
  fromNodeId: true,
  toNodeId: true,
  edgeType: true,
  weight: true,
  metadata: true,
});

// TypeScript types
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;

export type NoteEntity = typeof noteEntities.$inferSelect;
export type InsertNoteEntity = z.infer<typeof insertNoteEntitySchema>;

export type NoteRelationship = typeof noteRelationships.$inferSelect;
export type InsertNoteRelationship = z.infer<typeof insertNoteRelationshipSchema>;

export type KnowledgeNode = typeof knowledgeNodes.$inferSelect;
export type InsertKnowledgeNode = z.infer<typeof insertKnowledgeNodeSchema>;

export type KnowledgeEdge = typeof knowledgeEdges.$inferSelect;
export type InsertKnowledgeEdge = z.infer<typeof insertKnowledgeEdgeSchema>;

// Knowledge feedback schemas
export const insertKnowledgeFeedbackSchema = createCoercedInsertSchema(knowledgeFeedback).pick({
  noteId: true,
  fieldType: true,
  fieldIndex: true,
  feedback: true,
  originalValue: true,
  correctedValue: true,
});

export type KnowledgeFeedback = typeof knowledgeFeedback.$inferSelect;
export type InsertKnowledgeFeedback = z.infer<typeof insertKnowledgeFeedbackSchema>;

export type UserLearningProfile = typeof userLearningProfiles.$inferSelect;

// ========== 练习题相关表 ==========

// 练习题集表
export const quizzes = pgTable(
  "quizzes",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    noteId: varchar("note_id", { length: 36 }).notNull().references(() => notes.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    questions: jsonb("questions").$type<Array<{
      id: string;
      type: "choice" | "fill" | "short_answer";
      question: string;
      options?: string[];
      correct_answer: string;
      explanation?: string;
      difficulty: "easy" | "medium" | "hard";
    }>>().notNull().default([]),
    questionCount: integer("question_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("quizzes_user_id_idx").on(table.userId),
    index("quizzes_note_id_idx").on(table.noteId),
  ]
);

// 作答记录表
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    quizId: varchar("quiz_id", { length: 36 }).notNull().references(() => quizzes.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Array<{
      question_id: string;
      user_answer: string;
      is_correct: boolean;
      score: number; // 0-100 per question
      ai_feedback?: string;
    }>>().notNull().default([]),
    score: decimal("score", { precision: 5, scale: 2 }).notNull().default("0"),
    totalCorrect: integer("total_correct").notNull().default(0),
    totalQuestions: integer("total_questions").notNull().default(0),
    weakPoints: jsonb("weak_points").$type<string[]>().notNull().default([]),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("quiz_attempts_user_id_idx").on(table.userId),
    index("quiz_attempts_quiz_id_idx").on(table.quizId),
    index("quiz_attempts_completed_at_idx").on(table.completedAt),
  ]
);

// ========== 学习打卡表 ==========

export const studyCheckins = pgTable(
  "study_checkins",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    date: date("date").notNull(),
    studyMinutes: integer("study_minutes").notNull().default(0),
    notesCreated: integer("notes_created").notNull().default(0),
    notesReviewed: integer("notes_reviewed").notNull().default(0),
    quizzesTaken: integer("quizzes_taken").notNull().default(0),
    checkinNote: text("checkin_note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("study_checkins_user_id_idx").on(table.userId),
    index("study_checkins_date_idx").on(table.date),
    unique("study_checkins_user_date_unique").on(table.userId, table.date),
  ]
);

// ========== 新增 Zod Schemas ==========

export const insertQuizSchema = createCoercedInsertSchema(quizzes).pick({
  noteId: true,
  title: true,
  questions: true,
  questionCount: true,
});

export const insertQuizAttemptSchema = createCoercedInsertSchema(quizAttempts).pick({
  quizId: true,
  answers: true,
  score: true,
  totalCorrect: true,
  totalQuestions: true,
  weakPoints: true,
});

export const insertStudyCheckinSchema = createCoercedInsertSchema(studyCheckins).pick({
  date: true,
  studyMinutes: true,
  checkinNote: true,
});

// ========== 新增 TypeScript 类型 ==========

export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;

export type StudyCheckin = typeof studyCheckins.$inferSelect;
export type InsertStudyCheckin = z.infer<typeof insertStudyCheckinSchema>;

export type UserSkill = typeof userSkills.$inferSelect;
export type UserLlmConfig = typeof userLlmConfigs.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type GenerationJobChunk = typeof generationJobChunks.$inferSelect;
