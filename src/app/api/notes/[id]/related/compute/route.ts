import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

type RelatedNoteCandidate = {
  id: string;
  title: string;
  tags?: string[] | null;
  key_points?: unknown;
};

type NoteEntityRow = {
  note_id: string;
  entity_name: string;
};

type KeyPoint = string | { point?: string };

// 中文分词辅助（简单按标点和空格切分，过滤停用词）
function tokenize(text: string): string[] {
  if (!text) return [];
  const stopWords = new Set(["的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好", "自己", "这"]);
  return text
    .replace(/[，。！？、；：""''（）【】《》\s\n\r\t,.!?;:'"()\[\]{}<>]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w))
    .map(w => w.toLowerCase());
}

// Jaccard 相似度
function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// POST /api/notes/[id]/related/compute — 计算笔记相似度并存入 note_relationships
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  try {
    const user = getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const client = getApiClient();

    // 获取当前笔记
    const { data: currentNote, error: noteError } = await client
      .from("notes")
      .select("id, title, tags, key_points, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (noteError || !currentNote) {
      return NextResponse.json({ error: "笔记不存在" }, { status: 404 });
    }

    // 获取当前笔记的实体
    const { data: currentEntities } = await client
      .from("note_entities")
      .select("entity_name")
      .eq("note_id", id);

    // 获取用户的所有其他笔记
    const { data: otherNotes } = await client
      .from("notes")
      .select("id, title, tags, key_points")
      .eq("user_id", user.id)
      .neq("id", id)
      .is("deleted_at", null);

    if (!otherNotes || otherNotes.length === 0) {
      return NextResponse.json({ computed: 0, message: "没有其他笔记可比较" });
    }

    // 获取所有笔记的实体
    const typedOtherNotes = otherNotes as RelatedNoteCandidate[];
    const noteIds = typedOtherNotes.map((n) => n.id);
    const { data: allEntities } = await client
      .from("note_entities")
      .select("note_id, entity_name")
      .in("note_id", noteIds);

    // 构建实体映射
    const entityMap: Record<string, Set<string>> = {};
    ((allEntities || []) as NoteEntityRow[]).forEach((e) => {
      if (!entityMap[e.note_id]) entityMap[e.note_id] = new Set();
      entityMap[e.note_id].add(e.entity_name.toLowerCase());
    });

    const currentEntitySet = new Set(
      ((currentEntities || []) as Pick<NoteEntityRow, "entity_name">[]).map((e) => e.entity_name.toLowerCase())
    );
    const currentTags = new Set((currentNote.tags as string[] || []).map((t: string) => t.toLowerCase()));

    // 提取 key_points 文本
    const getKeyPointTexts = (kp: unknown): string[] => {
      if (!kp || !Array.isArray(kp)) return [];
      return (kp as KeyPoint[]).map((item) => {
        if (typeof item === "string") return item;
        if (item && item.point) return item.point;
        return "";
      }).filter(Boolean);
    };

    const currentKpTokens = new Set(
      getKeyPointTexts(currentNote.key_points).flatMap(tokenize)
    );
    const currentTitleTokens = new Set(tokenize(currentNote.title));

    // 计算每个笔记的相似度
    const similarities: Array<{ noteId: string; score: number }> = [];

    for (const otherNote of typedOtherNotes) {
      const otherTags = new Set((otherNote.tags as string[] || []).map((t: string) => t.toLowerCase()));
      const otherEntitySet = entityMap[otherNote.id] || new Set();
      const otherKpTokens = new Set(
        getKeyPointTexts(otherNote.key_points).flatMap(tokenize)
      );
      const otherTitleTokens = new Set(tokenize(otherNote.title));

      // 权重计算
      const tagSim = jaccard(currentTags, otherTags) * 0.35;
      const entitySim = jaccard(currentEntitySet, otherEntitySet) * 0.30;
      const kpSim = jaccard(currentKpTokens, otherKpTokens) * 0.20;
      const titleSim = jaccard(currentTitleTokens, otherTitleTokens) * 0.15;

      const totalScore = tagSim + entitySim + kpSim + titleSim;

      if (totalScore > 0.15) {
        similarities.push({ noteId: otherNote.id, score: Math.min(totalScore, 1) });
      }
    }

    // 取 top 10
    similarities.sort((a, b) => b.score - a.score);
    const top10 = similarities.slice(0, 10);

    // 清除旧的 similar 关系
    await client
      .from("note_relationships")
      .delete()
      .eq("from_note_id", id)
      .eq("relationship_type", "similar");

    // 写入新的关系
    if (top10.length > 0) {
      const records = top10.map((s) => ({
        from_note_id: id,
        to_note_id: s.noteId,
        relationship_type: "similar",
        confidence: s.score.toFixed(2),
        created_at: new Date().toISOString(),
      }));

      await client.from("note_relationships").insert(records);
    }

    return NextResponse.json({
      computed: top10.length,
      message: `已计算 ${top10.length} 个相关笔记`,
    });
  } catch (error) {
    console.error("Error computing related notes:", error);
    return NextResponse.json({ error: "计算相关笔记失败" }, { status: 500 });
  }
}
