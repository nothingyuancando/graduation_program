-- ============================================================
-- 智能笔记系统 - Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
--
-- 所有主键 / 外键统一使用 UUID 类型（Supabase 标准）
-- 支持幂等执行：表已存在则只补列，策略先删后建
-- ============================================================


-- ============================================================
-- 0. 用户表（自建认证，不依赖 Supabase Auth 服务）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email      VARCHAR(255) NOT NULL,
  password   TEXT         NOT NULL,   -- bcrypt 哈希，原始密码不存储
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- users 表只通过 service_role key 访问，无需额外 RLS 策略


-- ============================================================
-- 1. 上传会话表
-- ============================================================
CREATE TABLE IF NOT EXISTS upload_sessions (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL DEFAULT '未整理笔记',
  status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  total_files     INTEGER      NOT NULL DEFAULT 0,
  processed_files INTEGER      NOT NULL DEFAULT 0,
  metadata        JSONB,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE upload_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 修复外键：先删后建，确保指向 public.users 而非 auth.users
ALTER TABLE upload_sessions DROP CONSTRAINT IF EXISTS upload_sessions_user_id_fkey;
ALTER TABLE upload_sessions
  ADD CONSTRAINT upload_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS upload_sessions_user_id_idx    ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS upload_sessions_status_idx     ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS upload_sessions_created_at_idx ON upload_sessions(created_at);


-- ============================================================
-- 2. 文件处理队列表
-- ============================================================
CREATE TABLE IF NOT EXISTS file_processing_queue (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID         NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  original_file_name VARCHAR(500) NOT NULL,
  file_size          INTEGER      NOT NULL DEFAULT 0,
  file_type          VARCHAR(100) NOT NULL DEFAULT '',
  category           VARCHAR(50),
  -- text | image | presentation | spreadsheet | audio | video | archive | other
  file_key           TEXT,
  -- 对象存储 key / local:<name> / http:// URL
  status             VARCHAR(50)  NOT NULL DEFAULT 'pending',
  -- pending | processing | completed | failed
  extracted_text     TEXT,
  metadata           JSONB,
  error_message      TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  processed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS file_queue_session_id_idx ON file_processing_queue(session_id);
CREATE INDEX IF NOT EXISTS file_queue_status_idx     ON file_processing_queue(status);


-- ============================================================
-- 3. 笔记主表
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         REFERENCES users(id) ON DELETE CASCADE,
  title          VARCHAR(500) NOT NULL,
  content        TEXT         NOT NULL DEFAULT '',
  content_type   VARCHAR(50)  NOT NULL DEFAULT 'text',
  -- text | markdown | html
  summary        TEXT,
  tags           JSONB,                   -- string[]
  source_type    VARCHAR(50)  NOT NULL DEFAULT 'text',
  -- text | pdf | image | url | audio | video | mixed
  source_url     TEXT,
  session_id     UUID         REFERENCES upload_sessions(id) ON DELETE SET NULL,
  status         VARCHAR(50)  NOT NULL DEFAULT 'draft',
  -- draft | processed | analyzing | organized

  -- AI 生成的结构化内容
  themes         JSONB,       -- Array<{ name: string; importance: number }>
  key_points     JSONB,       -- Array<{point, sourceQuote, confidence}> | string[]
  structure      JSONB,       -- 章节层级
  entities       JSONB,       -- 实体集合
  metrics        JSONB,       -- 数字指标
  tasks          JSONB,       -- 待办任务
  timeline       JSONB,       -- 时间线

  -- 辅助学习资料
  mind_map       JSONB,       -- 思维导图节点/边
  flashcards     JSONB,       -- 知识卡片
  comparisons    JSONB,       -- 对比表格

  -- 版本管理
  version        INTEGER      NOT NULL DEFAULT 1,
  parent_note_id UUID         REFERENCES notes(id) ON DELETE SET NULL,
  is_public      BOOLEAN      NOT NULL DEFAULT FALSE,
  fork_count     INTEGER      NOT NULL DEFAULT 0,

  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS user_id UUID;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS fork_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS notes_deleted_at_idx ON notes(deleted_at);
CREATE INDEX IF NOT EXISTS notes_public_idx ON notes(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS notes_parent_note_id_idx ON notes(parent_note_id);

-- 修复外键：先删后建，确保指向 public.users 而非 auth.users
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE notes
  ADD CONSTRAINT notes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notes_user_id_idx    ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_status_idx     ON notes(status);
CREATE INDEX IF NOT EXISTS notes_created_at_idx ON notes(created_at);
CREATE INDEX IF NOT EXISTS notes_session_id_idx ON notes(session_id);


-- ============================================================
-- 4. 笔记版本历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS note_versions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  version    INTEGER      NOT NULL,
  title      VARCHAR(500) NOT NULL,
  content    TEXT         NOT NULL DEFAULT '',
  summary    TEXT,
  tags       JSONB,
  metadata   JSONB,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS note_versions_note_id_idx ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS note_versions_version_idx ON note_versions(version);


-- ============================================================
-- 5. 处理历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_history (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID         REFERENCES notes(id) ON DELETE CASCADE,
  session_id UUID         REFERENCES upload_sessions(id) ON DELETE CASCADE,
  action     VARCHAR(100) NOT NULL,
  -- upload | extract | analyze | clean | organize | export
  status     VARCHAR(50)  NOT NULL,
  -- pending | processing | completed | failed
  details    JSONB,
  duration   INTEGER,     -- 毫秒
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processing_history_note_id_idx    ON processing_history(note_id);
CREATE INDEX IF NOT EXISTS processing_history_session_id_idx ON processing_history(session_id);
CREATE INDEX IF NOT EXISTS processing_history_created_at_idx ON processing_history(created_at);


-- ============================================================
-- 6. 实体提取表
-- ============================================================
CREATE TABLE IF NOT EXISTS note_entities (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_type VARCHAR(50)  NOT NULL,
  -- person | organization | location | concept | date | number | task | other
  entity_name VARCHAR(500) NOT NULL,
  description TEXT,
  metadata    JSONB,
  confidence  DECIMAL(3,2) DEFAULT 0.00,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS note_entities_note_id_idx     ON note_entities(note_id);
CREATE INDEX IF NOT EXISTS note_entities_entity_type_idx ON note_entities(entity_type);


-- ============================================================
-- 7. 笔记关系表
-- ============================================================
CREATE TABLE IF NOT EXISTS note_relationships (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_note_id      UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  to_note_id        UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50)  NOT NULL,
  -- reference | similar | contains | relates_to
  confidence        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS note_relationships_from_idx ON note_relationships(from_note_id);
CREATE INDEX IF NOT EXISTS note_relationships_to_idx   ON note_relationships(to_note_id);


-- ============================================================
-- 8. 知识图谱节点表
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type        VARCHAR(50)  NOT NULL,   -- note | entity | concept
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  metadata    JSONB,
  note_id     UUID         REFERENCES notes(id) ON DELETE CASCADE,
  entity_name VARCHAR(500),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_nodes_type_idx    ON knowledge_nodes(type);
CREATE INDEX IF NOT EXISTS knowledge_nodes_note_id_idx ON knowledge_nodes(note_id);


-- ============================================================
-- 9. 知识图谱边表
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_edges (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID         NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id   UUID         NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  edge_type    VARCHAR(50)  NOT NULL,
  weight       DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  metadata     JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_edges_from_idx ON knowledge_edges(from_node_id);
CREATE INDEX IF NOT EXISTS knowledge_edges_to_idx   ON knowledge_edges(to_node_id);


-- ============================================================
-- 10. 健康检查表
-- ============================================================
CREATE TABLE IF NOT EXISTS health_check (
  id         SERIAL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- 11. 闪卡复习记录表（SM-2 间隔复习）
-- ============================================================
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id       UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  card_index    INTEGER      NOT NULL,        -- 在 flashcards 数组中的下标
  question      TEXT         NOT NULL,
  answer        TEXT         NOT NULL,
  ease_factor   FLOAT        NOT NULL DEFAULT 2.5,
  interval_days INTEGER      NOT NULL DEFAULT 0,
  repetitions   INTEGER      NOT NULL DEFAULT 0,
  due_date      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_reviewed TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, note_id, card_index)       -- 每张卡片只有一条记录
);

CREATE INDEX IF NOT EXISTS flashcard_reviews_user_due_idx ON flashcard_reviews(user_id, due_date);


-- ============================================================
-- 12. 知识点反馈表（用户对 AI 生成内容的纠错/确认）
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_feedback (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id         UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  field_type      VARCHAR(50)  NOT NULL,   -- 'key_point' | 'entity' | 'summary' | 'tag'
  field_index     INTEGER      NOT NULL DEFAULT 0,
  feedback        VARCHAR(20)  NOT NULL,   -- 'correct' | 'incorrect' | 'edited'
  original_value  TEXT,
  corrected_value TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_feedback_user_note_idx ON knowledge_feedback(user_id, note_id);
CREATE INDEX IF NOT EXISTS knowledge_feedback_user_idx ON knowledge_feedback(user_id);


-- ============================================================
-- 13. 用户学习画像表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  weak_concepts   JSONB        NOT NULL DEFAULT '[]',   -- Array<{concept, score, lastSeen}>
  strong_concepts JSONB        NOT NULL DEFAULT '[]',   -- Array<{concept, score, lastSeen}>
  interests       JSONB        NOT NULL DEFAULT '[]',   -- Array<string>
  study_stats     JSONB        NOT NULL DEFAULT '{}',   -- {totalNotes, totalReviews, avgConfidence...}
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13.1. 用户技能画像表
-- 代码中的学习路径、测验生成和学科分类会读取该表，初始化脚本必须同步创建。
-- ============================================================
CREATE TABLE IF NOT EXISTS user_skills (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  subject_levels  JSONB        NOT NULL DEFAULT '[]',
  learning_style  JSONB        NOT NULL DEFAULT '{"preferredFormat":"text","pace":"moderate","detailLevel":"moderate"}',
  goals           JSONB        NOT NULL DEFAULT '[]',
  strengths       JSONB        NOT NULL DEFAULT '[]',
  preferences     JSONB        NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_skills_user_id_idx ON user_skills(user_id);

-- ============================================================
-- 13.2. 学习闭环：目标、理解验证、掌握度
-- 这些表支撑“目标设定 -> 深度理解 -> 主动回忆 -> 弱点补强 -> 掌握评估”的主线。
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_goals (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  cognitive_level  VARCHAR(50)  NOT NULL DEFAULT 'understand',
  -- remember | understand | apply | analyze
  status           VARCHAR(50)  NOT NULL DEFAULT 'active',
  -- active | completed | paused | archived
  deadline         DATE,
  knowledge_points JSONB        NOT NULL DEFAULT '[]',
  daily_plan       JSONB        NOT NULL DEFAULT '[]',
  progress         INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_goals_user_id_idx ON learning_goals(user_id);
CREATE INDEX IF NOT EXISTS learning_goals_status_idx ON learning_goals(status);
CREATE INDEX IF NOT EXISTS learning_goals_created_at_idx ON learning_goals(created_at);

CREATE TABLE IF NOT EXISTS feynman_attempts (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_id             UUID         REFERENCES learning_goals(id) ON DELETE SET NULL,
  note_id             UUID         REFERENCES notes(id) ON DELETE SET NULL,
  concept             VARCHAR(500) NOT NULL,
  user_explanation    TEXT         NOT NULL,
  score               INTEGER      NOT NULL DEFAULT 0,
  level               VARCHAR(100),
  missing_points      JSONB        NOT NULL DEFAULT '[]',
  misconceptions      JSONB        NOT NULL DEFAULT '[]',
  follow_up_questions JSONB        NOT NULL DEFAULT '[]',
  recommended_review  JSONB        NOT NULL DEFAULT '[]',
  ai_feedback         TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feynman_attempts_user_id_idx ON feynman_attempts(user_id);
CREATE INDEX IF NOT EXISTS feynman_attempts_concept_idx ON feynman_attempts(concept);
CREATE INDEX IF NOT EXISTS feynman_attempts_created_at_idx ON feynman_attempts(created_at);

CREATE TABLE IF NOT EXISTS socratic_sessions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal_id       UUID         REFERENCES learning_goals(id) ON DELETE SET NULL,
  note_id       UUID         REFERENCES notes(id) ON DELETE SET NULL,
  concept       VARCHAR(500) NOT NULL,
  messages      JSONB        NOT NULL DEFAULT '[]',
  summary       TEXT,
  status        VARCHAR(50)  NOT NULL DEFAULT 'active',
  -- active | completed | archived
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS socratic_sessions_user_id_idx ON socratic_sessions(user_id);
CREATE INDEX IF NOT EXISTS socratic_sessions_status_idx ON socratic_sessions(status);

CREATE TABLE IF NOT EXISTS concept_mastery (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  concept         VARCHAR(500) NOT NULL,
  quiz_score      DECIMAL(5,2),
  flashcard_score DECIMAL(5,2),
  feynman_score   DECIMAL(5,2),
  mastery_score   DECIMAL(5,2) NOT NULL DEFAULT 0,
  evidence        JSONB        NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept)
);

CREATE INDEX IF NOT EXISTS concept_mastery_user_id_idx ON concept_mastery(user_id);
CREATE INDEX IF NOT EXISTS concept_mastery_score_idx ON concept_mastery(mastery_score);


-- ============================================================
-- 14. 练习题集表
-- ============================================================
CREATE TABLE IF NOT EXISTS quizzes (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id         UUID         NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  title           VARCHAR(500) NOT NULL,
  questions       JSONB        NOT NULL DEFAULT '[]',
  question_count  INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quizzes_user_id_idx ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS quizzes_note_id_idx ON quizzes(note_id);


-- ============================================================
-- 15. 作答记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id         UUID           NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  answers         JSONB          NOT NULL DEFAULT '[]',
  score           DECIMAL(5,2)   NOT NULL DEFAULT 0,
  total_correct   INTEGER        NOT NULL DEFAULT 0,
  total_questions INTEGER        NOT NULL DEFAULT 0,
  weak_points     JSONB          NOT NULL DEFAULT '[]',
  completed_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_id_idx ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_quiz_id_idx ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_completed_at_idx ON quiz_attempts(completed_at);


-- ============================================================
-- 16. 学习打卡表
-- ============================================================
CREATE TABLE IF NOT EXISTS study_checkins (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date            DATE         NOT NULL,
  study_minutes   INTEGER      NOT NULL DEFAULT 0,
  notes_created   INTEGER      NOT NULL DEFAULT 0,
  notes_reviewed  INTEGER      NOT NULL DEFAULT 0,
  quizzes_taken   INTEGER      NOT NULL DEFAULT 0,
  checkin_note    TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS study_checkins_user_id_idx ON study_checkins(user_id);
CREATE INDEX IF NOT EXISTS study_checkins_date_idx ON study_checkins(date);


-- ============================================================
-- 17. Subject classification and Skill run records
-- ============================================================

ALTER TABLE notes ADD COLUMN IF NOT EXISTS subject VARCHAR(100);
ALTER TABLE notes ADD COLUMN IF NOT EXISTS subject_confidence DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS subject_reason TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS classification_source VARCHAR(50) DEFAULT 'auto';

CREATE INDEX IF NOT EXISTS notes_subject_idx ON notes(subject);
CREATE INDEX IF NOT EXISTS notes_user_subject_idx ON notes(user_id, subject);

CREATE TABLE IF NOT EXISTS skill_runs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_id       UUID         REFERENCES notes(id) ON DELETE CASCADE,
  skill_id      VARCHAR(100) NOT NULL,
  intent        VARCHAR(100),
  input         JSONB,
  output        JSONB,
  status        VARCHAR(50)  NOT NULL DEFAULT 'completed',
  confidence    DECIMAL(3,2),
  error_message TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS skill_runs_user_id_idx ON skill_runs(user_id);
CREATE INDEX IF NOT EXISTS skill_runs_note_id_idx ON skill_runs(note_id);
CREATE INDEX IF NOT EXISTS skill_runs_skill_id_idx ON skill_runs(skill_id);


-- ============================================================
-- 18. 用户级 LLM 配置
-- ============================================================
CREATE TABLE IF NOT EXISTS user_llm_configs (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  provider        VARCHAR(50)  NOT NULL DEFAULT 'openai',
  model           VARCHAR(200) NOT NULL DEFAULT 'gpt-4o-mini',
  base_url        TEXT,
  api_key         TEXT,
  temperature     DECIMAL(3,2) NOT NULL DEFAULT 0.30,
  max_tokens      INTEGER      NOT NULL DEFAULT 4096,
  enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_llm_configs_user_id_idx ON user_llm_configs(user_id);


-- ============================================================
-- 19. 异步 AI 笔记生成任务
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_jobs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id       UUID         NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  note_id          UUID         REFERENCES notes(id) ON DELETE SET NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed | cancelled
  stage            VARCHAR(80)  NOT NULL DEFAULT 'queued',
  -- queued | preparing_chunks | analyzing_chunks | merging_analysis | generating_note | saving_note | completed | failed
  progress         INTEGER      NOT NULL DEFAULT 0,
  total_chunks     INTEGER      NOT NULL DEFAULT 0,
  processed_chunks INTEGER      NOT NULL DEFAULT 0,
  failed_chunks    INTEGER      NOT NULL DEFAULT 0,
  model            VARCHAR(200),
  error_message    TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generation_jobs_user_id_idx ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS generation_jobs_session_id_idx ON generation_jobs(session_id);
CREATE INDEX IF NOT EXISTS generation_jobs_status_idx ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS generation_jobs_created_at_idx ON generation_jobs(created_at);

CREATE TABLE IF NOT EXISTS generation_job_chunks (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID         NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  chunk_index       INTEGER      NOT NULL,
  source_file_names TEXT[]       NOT NULL DEFAULT '{}',
  chunk_text        TEXT         NOT NULL,
  status            VARCHAR(50)  NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed
  analysis_json     JSONB,
  error_message     TEXT,
  attempt_count     INTEGER      NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS generation_job_chunks_job_id_idx ON generation_job_chunks(job_id);
CREATE INDEX IF NOT EXISTS generation_job_chunks_status_idx ON generation_job_chunks(status);
CREATE INDEX IF NOT EXISTS generation_job_chunks_job_status_idx ON generation_job_chunks(job_id, status);


-- ============================================================
-- Row Level Security（RLS）
-- API 路由使用 service_role key 绕过 RLS，
-- 代码层手动过滤 user_id；RLS 仅防止直接访问数据库。
-- ============================================================

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes           ENABLE ROW LEVEL SECURITY;

-- 禁止任何匿名/直连访问（所有读写必须通过 service_role 的 API 路由）
DROP POLICY IF EXISTS "用户查看自己的会话" ON upload_sessions;
DROP POLICY IF EXISTS "用户创建自己的会话" ON upload_sessions;
DROP POLICY IF EXISTS "用户更新自己的会话" ON upload_sessions;
DROP POLICY IF EXISTS "用户删除自己的会话" ON upload_sessions;
DROP POLICY IF EXISTS "用户查看自己的笔记" ON notes;
DROP POLICY IF EXISTS "用户创建自己的笔记" ON notes;
DROP POLICY IF EXISTS "用户更新自己的笔记" ON notes;
DROP POLICY IF EXISTS "用户删除自己的笔记" ON notes;
