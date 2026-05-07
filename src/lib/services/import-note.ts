import { createLLMClient } from "@/lib/llm-provider";

type ImportedLearningNote = {
  content: string;
  summary: string;
  tags: string[];
  keyPoints: Array<{ point: string; sourceQuote: string; confidence: number }>;
  mindMap: MindMapNode;
};

type MindMapNode = {
  id: string;
  label: string;
  description?: string;
  type?: string;
  children?: MindMapNode[];
};

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdownFence(value: string) {
  return value
    .replace(/^```markdown\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function splitSentences(value: string) {
  return compactText(value)
    .split(/(?<=[。！？.!?])\s+|[。！？.!?]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12);
}

function extractTags(title: string, sourceText: string) {
  const candidates = `${title} ${sourceText}`
    .match(/[\u4e00-\u9fa5A-Za-z0-9]{2,18}/g)
    ?.filter((item) => !/^\d+$/.test(item)) || [];

  return Array.from(new Set(candidates)).slice(0, 6);
}

function cleanHeading(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\[\[|\]\]/g, "")
    .trim();
}

function excerpt(value: string, maxLength = 90) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function buildMindMap(input: {
  title: string;
  content: string;
  summary: string;
  tags: string[];
  keyPoints: Array<{ point: string; sourceQuote: string; confidence: number }>;
}): MindMapNode {
  const lines = input.content.split(/\r?\n/);
  const headingNodes = lines
    .map((line) => line.match(/^(#{2,4})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .slice(0, 8)
    .map((match, index) => {
      const startLine = lines.findIndex((line) => line.trim() === match[0].trim());
      const nextHeading = lines.findIndex((line, lineIndex) => lineIndex > startLine && /^#{2,4}\s+/.test(line));
      const sectionLines = lines
        .slice(startLine + 1, nextHeading === -1 ? startLine + 8 : nextHeading)
        .filter((line) => line.trim());

      return {
        id: `section-${index}`,
        label: cleanHeading(match[2]),
        description: excerpt(sectionLines.join(" "), 96),
        type: "section",
      };
    });

  const keyPointNodes = input.keyPoints.slice(0, 6).map((item, index) => ({
    id: `key-point-${index}`,
    label: excerpt(item.point, 30),
    description: excerpt(item.point || item.sourceQuote, 90),
    type: "key_point",
  }));

  const children: MindMapNode[] = [
    {
      id: "summary",
      label: "学习摘要",
      description: excerpt(input.summary, 120),
      type: "summary",
    },
  ];

  if (headingNodes.length > 0) {
    children.push({
      id: "sections",
      label: "笔记结构",
      description: "从生成的 Markdown 小节整理",
      type: "group",
      children: headingNodes,
    });
  }

  if (keyPointNodes.length > 0) {
    children.push({
      id: "key-points",
      label: "核心要点",
      description: "后续测验和复述优先围绕这些点",
      type: "group",
      children: keyPointNodes,
    });
  }

  return {
    id: "root",
    label: input.title,
    description: input.tags.slice(0, 4).join(" / "),
    type: "note",
    children,
  };
}

export function buildLocalLearningMetadata(input: {
  title: string;
  content: string;
  subject?: string | null;
}) {
  const content = input.content.trim();
  const sentences = splitSentences(content);
  const headings = content
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,4}\s+(.+)$/)?.[1])
    .filter((item): item is string => Boolean(item))
    .map(cleanHeading);
  const concepts = Array.from(content.matchAll(/\[\[([^\]\n]+)\]\]/g))
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));

  const summarySeeds = [
    ...sentences.slice(0, 2),
    ...headings.slice(0, 2).map((heading) => `围绕「${heading}」展开学习记录`),
  ].filter(Boolean);
  const summary = summarySeeds.join("。").slice(0, 240) || `${input.title} 的学习笔记`;

  const tags = Array.from(new Set([
    input.subject || "",
    ...concepts,
    ...headings.slice(0, 4),
    ...extractTags(input.title, content).slice(0, 4),
  ].map((item) => item.trim()).filter(Boolean))).slice(0, 8);

  const keyPointTexts = Array.from(new Set([
    ...concepts.map((concept) => `理解并能复述「${concept}」`),
    ...headings.slice(0, 6),
    ...sentences.slice(0, 8),
  ].map((item) => item.trim()).filter((item) => item.length >= 4))).slice(0, 8);

  const keyPoints = keyPointTexts.map((point) => ({
    point: point.slice(0, 140),
    sourceQuote: point.slice(0, 180),
    confidence: 0.72,
  }));

  return {
    summary,
    tags,
    keyPoints,
    mindMap: buildMindMap({
      title: input.title,
      content,
      summary,
      tags,
      keyPoints,
    }),
  };
}

function buildFallbackImportedNote(input: {
  title: string;
  sourceText: string;
  sourceLabel: string;
}): ImportedLearningNote {
  const sentences = splitSentences(input.sourceText);
  const keySentences = sentences.slice(0, 8);
  const summary = keySentences.slice(0, 2).join("。").slice(0, 220) || compactText(input.sourceText).slice(0, 220);
  const tags = extractTags(input.title, input.sourceText);
  const keyPoints = keySentences.slice(0, 8).map((sentence) => ({
    point: sentence.slice(0, 120),
    sourceQuote: sentence.slice(0, 120),
    confidence: 0.62,
  }));

  const content = [
    `# ${input.title}`,
    "",
    "## 学习摘要",
    summary || "系统已导入资料，但可用于整理的文本较少。",
    "",
    "## 核心知识点",
    ...(keyPoints.length
      ? keyPoints.map((item, index) => `${index + 1}. ${item.point}`)
      : ["1. 暂未提取到稳定知识点，请检查资料是否包含可复制文本。"]),
    "",
    "## 关键证据",
    ...(keyPoints.length
      ? keyPoints.map((item, index) => `- 证据 ${index + 1}：${item.sourceQuote}`)
      : ["- 暂无可引用证据。"]),
    "",
    "## 复述检查",
    "- 这份资料主要想解决什么问题？",
    "- 其中最关键的概念是什么？请用自己的话解释。",
    "- 哪一条证据最能支撑核心结论？",
    "",
    "## 后续学习动作",
    "- 先用费曼复述验证核心概念。",
    "- 再生成测验，检查是否能主动回忆。",
    "- 对答错或说不清的内容，回到上面的关键证据补强。",
    "",
    "## 原始资料摘录",
    `> 来源：${input.sourceLabel}`,
    "",
    compactText(input.sourceText).slice(0, 6000),
  ].join("\n");

  return { content, summary, tags, keyPoints, mindMap: buildMindMap({ title: input.title, content, summary, tags, keyPoints }) };
}

function parseImportedNoteJson(content: string): Omit<ImportedLearningNote, "mindMap"> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ImportedLearningNote>;
    if (!parsed.content || !parsed.summary) return null;
    return {
      content: stripMarkdownFence(String(parsed.content)),
      summary: String(parsed.summary).trim(),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [],
      keyPoints: Array.isArray(parsed.keyPoints)
        ? parsed.keyPoints
            .filter((item) => item?.point)
            .map((item) => ({
              point: String(item.point).trim(),
              sourceQuote: String(item.sourceQuote || item.point).trim().slice(0, 180),
              confidence: Math.max(0, Math.min(Number(item.confidence) || 0.75, 1)),
            }))
            .slice(0, 8)
        : [],
    };
  } catch (error) {
    console.error("Failed to parse imported learning note JSON:", error);
    return null;
  }
}

export async function generateImportedLearningNote(input: {
  title: string;
  sourceText: string;
  sourceLabel: string;
  userId?: string;
}): Promise<ImportedLearningNote> {
  const fallback = buildFallbackImportedNote(input);
  const sourceText = compactText(input.sourceText);

  if (sourceText.length < 20) {
    return fallback;
  }

  const sourcePreview = sourceText.slice(0, 24000);
  const prompt = `请把下面导入的学习资料整理成一篇可以直接学习、复述和测验的 Markdown 学习笔记。

标题：${input.title}
来源：${input.sourceLabel}

原始资料：
<<<SOURCE
${sourcePreview}
SOURCE

请只返回 JSON，不要包裹代码块：
{
  "content": "完整 Markdown 学习笔记",
  "summary": "1-2句话学习摘要",
  "tags": ["标签"],
  "keyPoints": [
    {
      "point": "关键知识点",
      "sourceQuote": "来自原始资料的短证据",
      "confidence": 0.9
    }
  ]
}

content 必须包含这些部分：
# 标题
## 学习摘要
## 核心知识点
## 关键概念
## 易错点或容易混淆处
## 复述检查
## 后续学习动作

要求：
1. 不要把原文整段搬运给用户，要整理成学习笔记。
2. 只基于原始资料，不要编造资料外事实。
3. 核心知识点要适合后续生成测验。
4. 复述检查要包含 3 个可用来费曼复述的问题。
5. content 不要过短。普通材料至少整理 1200-2200 字；材料信息量很大时整理 2200-4000 字。
6. 每个核心知识点都要尽量写清“定义 / 作用 / 例子或证据 / 易错点”中的至少两项。
7. 后续学习动作要能直接引导用户进入费曼复述、测验和复习。`;

  try {
    const llm = createLLMClient({ userId: input.userId });
    const response = await llm.invoke(
      [
        {
          role: "system",
          content: "你是学习资料整理助手，负责把原始资料转成结构化、可复述、可测验的学习笔记。",
        },
        { role: "user", content: prompt },
      ],
      { temperature: 0.25, maxTokens: 8192 }
    );

    const parsed = parseImportedNoteJson(response.content);
    if (!parsed?.content) return fallback;
    const keyPoints = parsed.keyPoints.length ? parsed.keyPoints : fallback.keyPoints;
    const tags = parsed.tags.length ? parsed.tags : fallback.tags;
    return {
      ...parsed,
      keyPoints,
      tags,
      mindMap: buildMindMap({
        title: input.title,
        content: parsed.content,
        summary: parsed.summary,
        tags,
        keyPoints,
      }),
    };
  } catch (error) {
    console.error("Imported note generation failed, using fallback:", error);
    return fallback;
  }
}
