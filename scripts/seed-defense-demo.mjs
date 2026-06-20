import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.COZE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.COZE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL/SUPABASE_SERVICE_KEY in .env.local");
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = "raglearner@example.com";
const DEMO_PASSWORD = "learn123";
const LEGACY_EMAILS = ["defense@example.com"];
const now = new Date();

const sourceFiles = [
  {
    title: "RAG 原理解读：让检索增强生成不再是黑盒",
    path: "../RAG专栏/01-RAG基础与快速入门/01-RAG原理解读：让检索增强生成不再是黑盒.md",
    focus: "RAG 基础流程",
  },
  {
    title: "现代 RAG 检索增强：Contextual Retrieval、多向量检索与自纠错",
    path: "../RAG专栏/03-检索与召回优化/01-现代 RAG 检索增强：Contextual Retrieval、多向量检索与自纠错.md",
    focus: "召回优化",
  },
  {
    title: "生产级 RAG：可信输出、证据引用与拒答机制",
    path: "../RAG专栏/06-生产治理与高级RAG/01-生产级 RAG：可信输出、证据引用与拒答机制.md",
    focus: "可信问答",
  },
  {
    title: "RAG 摄取工程：解析、结构化与持续入库",
    path: "../RAG专栏/02-数据摄取与索引基础/01-RAG 摄取工程：解析、结构化与持续入库.md",
    focus: "资料摄取",
  },
];

function isoDaysAgo(days) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function dateDaysFrom(days) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function readExcerpt(relativePath, maxChars = 5600) {
  const fullPath = resolve(process.cwd(), relativePath);
  const text = readFileSync(fullPath, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, maxChars);
}

function noteContent({ title, source, focus, concepts, daysAgo }) {
  const conceptLinks = concepts.map((item) => `[[${item}]]`).join("、");
  return `# ${title}

## 学习目标
这篇资料被整理进“RAG 系统从原理到上线”的学习空间，重点围绕 ${focus} 展开。系统已经从原文中抽取了核心概念：${conceptLinks}。

## AI 结构化摘要
- RAG 的价值不是简单把资料塞进提示词，而是把资料解析、切分、索引、召回、重排、证据引用和生成约束串成可验证流程。
- 对学习场景来说，资料导入后需要生成摘要、知识点、闪卡、测验和弱点追踪，让“看过资料”变成“能够复述与迁移应用”。
- 生产环境中的 RAG 需要关注证据链、拒答机制、权限边界、检索质量评估和持续反馈闭环。

## 关键知识点
1. 数据摄取决定知识库下限，解析质量、分块策略和元数据会直接影响后续召回效果。
2. 检索阶段可以组合 Dense Retrieval、BM25、Hybrid Search、Rerank、Contextual Retrieval 等策略。
3. 生成阶段必须要求模型基于证据回答，对证据不足、证据冲突和高风险问题要降级或拒答。
4. 学习平台需要把笔记、概念、测验、费曼复述、打卡和掌握度连起来，形成持续学习闭环。

## 原文片段
${source}

## 学习提示
- 这条笔记展示了系统支持从外部资料导入到结构化学习资产的完整路径。
- 页面中的知识图谱、闪卡和测验并不是孤立功能，而是围绕同一批概念反复验证理解。
- 更新时间：${isoDaysAgo(daysAgo).slice(0, 10)}，适合作为最近学习记录。`;
}

function buildFlashcards(concepts) {
  return concepts.slice(0, 4).map((concept) => ({
    question: `${concept} 在 RAG 学习闭环中解决什么问题？`,
    answer: `${concept} 用来提升资料理解、检索可靠性或生成可信度，是从资料导入走向可验证掌握的重要环节。`,
    difficulty: concept.includes("拒答") || concept.includes("重排") ? "medium" : "easy",
  }));
}

function buildMindMap(title, concepts) {
  return {
    id: "root",
    label: title,
    type: "note",
    children: [
      {
        id: "ingestion",
        label: "资料摄取",
        type: "group",
        children: concepts.slice(0, 2).map((label, index) => ({
          id: `ingestion-${index}`,
          label,
          type: "concept",
        })),
      },
      {
        id: "retrieval",
        label: "检索增强",
        type: "group",
        children: concepts.slice(2, 5).map((label, index) => ({
          id: `retrieval-${index}`,
          label,
          type: "concept",
        })),
      },
      {
        id: "validation",
        label: "学习验证",
        type: "group",
        children: concepts.slice(5).map((label, index) => ({
          id: `validation-${index}`,
          label,
          type: "concept",
        })),
      },
    ],
  };
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

async function deleteUserData(userId) {
  const tables = [
    "generation_jobs",
    "study_checkins",
    "quiz_attempts",
    "quizzes",
    "skill_runs",
    "concept_mastery",
    "socratic_sessions",
    "feynman_attempts",
    "user_llm_configs",
    "user_skills",
    "user_learning_profiles",
    "flashcard_reviews",
    "knowledge_feedback",
    "learning_goals",
    "notes",
    "upload_sessions",
  ];

  for (const table of tables) {
    await client.from(table).delete().eq("user_id", userId);
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const legacyEmail of LEGACY_EMAILS) {
    const legacyUser = await must(
      `find legacy user ${legacyEmail}`,
      client.from("users").select("id").eq("email", legacyEmail).maybeSingle()
    );
    if (legacyUser) {
      await deleteUserData(legacyUser.id);
    }
  }

  const existing = await must(
    "find seed user",
    client.from("users").select("id, email").eq("email", DEMO_EMAIL).maybeSingle()
  );

  let user = existing;
  if (!user) {
    user = await must(
      "create demo user",
      client.from("users").insert({ email: DEMO_EMAIL, password: passwordHash }).select("id, email").single()
    );
  } else {
    await must("update seed password", client.from("users").update({ password: passwordHash }).eq("id", user.id));
    await deleteUserData(user.id);
  }

  await must(
    "create learning profile",
    client.from("user_learning_profiles").upsert({
      user_id: user.id,
      weak_concepts: [
        { concept: "Rerank 重排", score: 0.42, lastSeen: isoDaysAgo(1) },
        { concept: "证据引用", score: 0.48, lastSeen: isoDaysAgo(2) },
        { concept: "Query Decomposition", score: 0.52, lastSeen: isoDaysAgo(3) },
      ],
      strong_concepts: [
        { concept: "RAG 基本流程", score: 0.88, lastSeen: isoDaysAgo(1) },
        { concept: "向量检索", score: 0.82, lastSeen: isoDaysAgo(2) },
        { concept: "资料摄取", score: 0.79, lastSeen: isoDaysAgo(4) },
      ],
      interests: ["RAG", "知识图谱", "个性化学习", "费曼复述", "检索增强生成"],
      study_stats: {
        totalNotes: 4,
        totalReviews: 12,
        avgConfidence: 0.78,
        streakDays: 6,
        readiness: "high",
      },
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })
  );

  await must(
    "create user skills",
    client.from("user_skills").insert({
      user_id: user.id,
      subject_levels: [
        { subject: "RAG", level: "intermediate", confidence: 0.82 },
        { subject: "Next.js", level: "intermediate", confidence: 0.76 },
        { subject: "Supabase", level: "basic", confidence: 0.68 },
      ],
      learning_style: { preferredFormat: "text", pace: "moderate", detailLevel: "detailed" },
      goals: ["完整掌握 RAG 学习闭环", "能解释 RAG 系统的工程化流程"],
      strengths: ["概念总结", "流程拆解", "系统实践"],
      preferences: { language: "zh-CN" },
      updated_at: now.toISOString(),
    })
  );

  const goal = await must(
    "create learning goal",
    client
      .from("learning_goals")
      .insert({
        user_id: user.id,
        title: "RAG 系统从原理到上线",
        description: "围绕 RAG 专栏资料完成导入、结构化笔记、知识图谱、费曼复述、测验与弱点补强的完整学习闭环。",
        cognitive_level: "analyze",
        status: "active",
        deadline: dateDaysFrom(1),
        knowledge_points: [
          "RAG 基本流程",
          "资料摄取",
          "向量检索",
          "Hybrid Search",
          "Rerank 重排",
          "证据引用",
          "拒答机制",
          "学习闭环",
        ],
        daily_plan: [
          { day: "今天", task: "复习 RAG 基础流程与系统学习路径", done: true },
          { day: "明天", task: "完成资料导入、知识图谱和测验生成练习", done: false },
          { day: "后续", task: "根据老师问题补充复杂问答与生产治理案例", done: false },
        ],
        progress: 76,
        created_at: isoDaysAgo(6),
        updated_at: now.toISOString(),
      })
      .select()
      .single()
  );

  const session = await must(
    "create upload session",
    client
      .from("upload_sessions")
      .insert({
        user_id: user.id,
        title: "RAG 专栏资料批量导入",
        status: "completed",
        total_files: sourceFiles.length,
        processed_files: sourceFiles.length,
        metadata: {
          source: "RAG专栏",
          goalId: goal.id,
          note: "批量摄取后形成结构化笔记。",
        },
        created_at: isoDaysAgo(5),
        updated_at: now.toISOString(),
      })
      .select()
      .single()
  );

  const conceptSets = [
    ["RAG 基本流程", "大模型幻觉", "资料摄取", "向量检索", "Prompt 增强", "学习闭环"],
    ["Contextual Retrieval", "Hybrid Search", "多向量检索", "Rerank 重排", "Self-RAG", "Query Decomposition"],
    ["证据引用", "可信输出", "拒答机制", "检索质量评估", "权限边界", "生产级 RAG"],
    ["文档解析", "分块策略", "元数据", "索引构建", "持续入库", "OCR"],
  ];

  const notes = [];
  for (const [index, item] of sourceFiles.entries()) {
    const concepts = conceptSets[index];
    const source = readExcerpt(item.path);
    const createdAt = isoDaysAgo(5 - index);
    const note = await must(
      `create note ${index + 1}`,
      client
        .from("notes")
        .insert({
          user_id: user.id,
          title: item.title,
          content: noteContent({ ...item, source, concepts, daysAgo: 5 - index }),
          content_type: "markdown",
          summary: `围绕${item.focus}整理的 RAG 学习笔记，已抽取关键概念、闪卡和知识图谱节点，可用于学习闭环。`,
          tags: ["RAG", item.focus, "AI 学习笔记"],
          source_type: "text",
          source_url: item.path.replace("../", ""),
          session_id: session.id,
          status: "processed",
          themes: [
            { name: item.focus, importance: 0.92 },
            { name: "个性化学习", importance: 0.78 },
          ],
          key_points: concepts.map((concept) => ({
            point: concept,
            sourceQuote: `资料中与 ${concept} 相关的段落已被整理为学习卡片。`,
            confidence: 0.86,
          })),
          structure: [
            { heading: "学习目标", level: 2 },
            { heading: "AI 结构化摘要", level: 2 },
            { heading: "关键知识点", level: 2 },
            { heading: "学习提示", level: 2 },
          ],
          entities: concepts.map((name) => ({ name, type: "concept" })),
          mind_map: buildMindMap(item.title, concepts),
          flashcards: buildFlashcards(concepts),
          comparisons: [
            {
              title: "传统问答与 RAG 问答对比",
              headers: ["维度", "传统问答", "RAG 问答"],
              rows: [
                ["知识来源", "主要依赖模型内部知识", "先检索外部资料，再基于证据生成回答"],
                ["可信度", "证据链较弱", "可以展示来源、片段和引用"],
                ["适用场景", "通用开放问答", "课程资料、企业知识库、专业文档问答"],
              ],
            },
          ],
          subject: "人工智能 / RAG",
          subject_confidence: 0.96,
          subject_reason: "资料来自 RAG 专栏，主题明确。",
          classified_at: createdAt,
          classification_source: "seed",
          is_public: index === 0,
          fork_count: index === 0 ? 7 : 0,
          created_at: createdAt,
          updated_at: isoDaysAgo(index),
        })
        .select()
        .single()
    );
    notes.push({ ...note, concepts });
  }

  for (const note of notes) {
    await must(
      `create entities for ${note.title}`,
      client.from("note_entities").insert(
        note.concepts.map((concept, index) => ({
          note_id: note.id,
          entity_type: "concept",
          entity_name: concept,
          description: `${concept} 是该学习空间中的核心知识点，关联到 RAG 系统设计与学习闭环。`,
          confidence: 0.82 + index * 0.02,
          metadata: { goalId: goal.id },
          created_at: note.created_at,
        }))
      )
    );
  }

  const nodeRows = [];
  for (const note of notes) {
    nodeRows.push({
      type: "note",
      title: note.title,
      description: note.summary,
      note_id: note.id,
      metadata: { goalId: goal.id },
      created_at: note.created_at,
      updated_at: note.updated_at,
    });
  }

  const uniqueConcepts = [...new Set(conceptSets.flat())];
  for (const concept of uniqueConcepts) {
    nodeRows.push({
      type: "concept",
      title: concept,
      description: `${concept} 与 RAG 学习闭环、资料导入、检索增强或可信生成相关。`,
      entity_name: concept,
      metadata: { goalId: goal.id },
      created_at: isoDaysAgo(4),
      updated_at: now.toISOString(),
    });
  }

  const nodes = await must(
    "create knowledge nodes",
    client.from("knowledge_nodes").insert(nodeRows).select()
  );
  const nodesByTitle = new Map(nodes.map((node) => [node.title, node]));
  const edges = [];

  for (const note of notes) {
    const noteNode = nodes.find((node) => node.note_id === note.id);
    for (const concept of note.concepts) {
      edges.push({
        from_node_id: noteNode.id,
        to_node_id: nodesByTitle.get(concept).id,
        edge_type: "contains",
        weight: 0.86,
        metadata: { source: "seed" },
      });
    }
  }

  for (const [from, to] of [
    ["资料摄取", "向量检索"],
    ["向量检索", "Hybrid Search"],
    ["Hybrid Search", "Rerank 重排"],
    ["Rerank 重排", "证据引用"],
    ["证据引用", "可信输出"],
    ["可信输出", "拒答机制"],
    ["RAG 基本流程", "学习闭环"],
  ]) {
    edges.push({
      from_node_id: nodesByTitle.get(from).id,
      to_node_id: nodesByTitle.get(to).id,
      edge_type: "relates_to",
      weight: 0.78,
      metadata: { source: "seed" },
    });
  }

  await must("create knowledge edges", client.from("knowledge_edges").insert(edges));

  const quiz = await must(
    "create quiz",
    client
      .from("quizzes")
      .insert({
        user_id: user.id,
        note_id: notes[0].id,
        title: "RAG 基础与可信问答测验",
        question_count: 5,
        questions: [
          {
            type: "single",
            question: "RAG 相比纯大模型问答的核心优势是什么？",
            options: ["引入外部知识证据", "完全不需要模型", "只提升页面速度", "只能处理图片"],
            answer: "引入外部知识证据",
            explanation: "RAG 通过检索外部知识并将证据提供给模型，降低幻觉并提升专业问题回答质量。",
          },
          {
            type: "single",
            question: "当检索证据不足时，生产级 RAG 更推荐怎么做？",
            options: ["明确拒答或降级", "编造一个完整答案", "删除用户问题", "跳过引用"],
            answer: "明确拒答或降级",
            explanation: "可信输出要求答案不越过证据边界。",
          },
          {
            type: "short",
            question: "Hybrid Search 通常结合哪两类信号？",
            answer: "关键词检索信号和语义向量检索信号。",
          },
          {
            type: "short",
            question: "为什么学习系统中要展示知识图谱？",
            answer: "它能说明系统不只保存笔记，还能抽取概念关系并支持后续复习、测验和弱点分析。",
          },
          {
            type: "single",
            question: "费曼复述主要验证什么？",
            options: ["是否能用自己的话讲清概念", "文件是否上传成功", "数据库是否能连接", "页面颜色是否好看"],
            answer: "是否能用自己的话讲清概念",
          },
        ],
        created_at: isoDaysAgo(1),
      })
      .select()
      .single()
  );

  await must(
    "create quiz attempt",
    client.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      answers: [
        { questionIndex: 0, answer: "引入外部知识证据", correct: true },
        { questionIndex: 1, answer: "明确拒答或降级", correct: true },
        { questionIndex: 2, answer: "关键词检索信号和语义向量检索信号", correct: true },
        { questionIndex: 3, answer: "支持知识组织", correct: true },
        { questionIndex: 4, answer: "是否能用自己的话讲清概念", correct: true },
      ],
      score: 92,
      total_correct: 5,
      total_questions: 5,
      weak_points: ["Rerank 重排", "证据引用"],
      completed_at: isoDaysAgo(1),
    })
  );

  await must(
    "create feynman attempts",
    client.from("feynman_attempts").insert([
      {
        user_id: user.id,
        goal_id: goal.id,
        note_id: notes[0].id,
        concept: "RAG 基本流程",
        user_explanation: "先把资料解析切分并建立索引，用户提问后检索相关片段，把证据放进提示词，再由大模型基于证据生成答案。",
        score: 86,
        level: "掌握较好",
        missing_points: ["可以补充评估指标"],
        misconceptions: [],
        follow_up_questions: ["如果检索结果冲突，系统应该如何处理？"],
        recommended_review: ["证据引用", "拒答机制"],
        ai_feedback: "解释完整，已经能把离线入库和在线问答串起来。建议进一步补充生产环境的可信输出策略。",
        created_at: isoDaysAgo(2),
      },
      {
        user_id: user.id,
        goal_id: goal.id,
        note_id: notes[1].id,
        concept: "Rerank 重排",
        user_explanation: "重排是在初步召回后，对候选片段重新排序，让更能回答问题的证据排在前面。",
        score: 72,
        level: "基本理解",
        missing_points: ["重排模型与召回模型职责不同", "需要结合 NDCG/MRR 评估"],
        misconceptions: [],
        follow_up_questions: ["为什么不能只依赖向量相似度？"],
        recommended_review: ["Hybrid Search", "检索质量评估"],
        ai_feedback: "方向正确，建议补充它在复杂问题中的收益和评估方式。",
        created_at: isoDaysAgo(1),
      },
    ])
  );

  await must(
    "create concept mastery",
    client.from("concept_mastery").insert(
      [
        ["RAG 基本流程", 88, 92, 86],
        ["资料摄取", 80, 84, 78],
        ["向量检索", 82, 86, 76],
        ["Hybrid Search", 74, 78, 70],
        ["Rerank 重排", 58, 64, 72],
        ["证据引用", 62, 68, 66],
        ["拒答机制", 70, 72, 68],
        ["学习闭环", 84, 88, 82],
      ].map(([concept, mastery, quizScore, feynmanScore]) => ({
        user_id: user.id,
        concept,
        quiz_score: quizScore,
        flashcard_score: mastery,
        feynman_score: feynmanScore,
        mastery_score: mastery,
        evidence: { goalId: goal.id },
        updated_at: now.toISOString(),
      }))
    )
  );

  const flashcards = [];
  for (const note of notes.slice(0, 3)) {
    note.concepts.slice(0, 3).forEach((concept, index) => {
      flashcards.push({
        user_id: user.id,
        note_id: note.id,
        card_index: index,
        question: `${concept} 的核心作用是什么？`,
        answer: `${concept} 帮助 RAG 系统在资料理解、检索增强或可信生成环节提升效果，并能转化为复习和测验任务。`,
        ease_factor: index === 0 ? 2.7 : 2.4,
        interval_days: index,
        repetitions: index + 1,
        due_date: index === 0 ? isoDaysAgo(1) : now.toISOString(),
        last_reviewed: index === 0 ? isoDaysAgo(3) : null,
        created_at: isoDaysAgo(4),
      });
    });
  }
  await must("create flashcard reviews", client.from("flashcard_reviews").insert(flashcards));

  await must(
    "create study checkins",
    client.from("study_checkins").insert([
      { user_id: user.id, date: dateDaysFrom(-5), study_minutes: 45, notes_created: 1, notes_reviewed: 1, quizzes_taken: 0, checkin_note: "导入 RAG 基础资料。" },
      { user_id: user.id, date: dateDaysFrom(-4), study_minutes: 50, notes_created: 1, notes_reviewed: 2, quizzes_taken: 0, checkin_note: "整理检索增强策略。" },
      { user_id: user.id, date: dateDaysFrom(-3), study_minutes: 35, notes_created: 1, notes_reviewed: 2, quizzes_taken: 0, checkin_note: "补充可信输出与拒答机制。" },
      { user_id: user.id, date: dateDaysFrom(-2), study_minutes: 60, notes_created: 0, notes_reviewed: 3, quizzes_taken: 1, checkin_note: "完成费曼复述。" },
      { user_id: user.id, date: dateDaysFrom(-1), study_minutes: 40, notes_created: 1, notes_reviewed: 4, quizzes_taken: 1, checkin_note: "整理 RAG 学习路线。" },
    ])
  );

  await must(
    "create public loop note",
    client.from("notes").insert({
      user_id: user.id,
      title: "公开模板：RAG 从入门到生产治理学习闭环",
      content: `# RAG 从入门到生产治理学习闭环

这个公开学习闭环模板包含目标设定、资料摄取、结构化笔记、概念图谱、费曼复述、测验与弱点补强。适合展示“学习资料如何被系统转化为可验证的掌握过程”。`,
      content_type: "markdown",
      summary: "可在学习闭环广场展示的公开模板，便于分享与 Fork。",
      tags: ["学习闭环", "RAG", "公开模板"],
      source_type: "text",
      status: "processed",
      subject: "人工智能 / RAG",
      is_public: true,
      fork_count: 12,
      created_at: isoDaysAgo(2),
      updated_at: now.toISOString(),
    })
  );

  console.log("RAG learning data is ready.");
  console.log(`URL: http://localhost:5000`);
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Goal: ${goal.title}`);
  console.log(`Notes: ${notes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
