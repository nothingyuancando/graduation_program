import { NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// POST /api/knowledge-graph/sync - 同步知识图谱
export async function POST() {
  try {
    const client = getApiClient();

    // 获取所有已处理的笔记
    const { data: notes, error: notesError } = await client
      .from("notes")
      .select("*")
      .eq("status", "processed");

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 400 });
    }

    // 获取所有实体
    const { data: entities, error: entitiesError } = await client
      .from("note_entities")
      .select("*");

    if (entitiesError) {
      return NextResponse.json({ error: entitiesError.message }, { status: 400 });
    }

    // 清空现有的知识图谱
    await client.from("knowledge_edges").delete().neq("id", "0");
    await client.from("knowledge_nodes").delete().neq("id", "0");

    const nodeMap = new Map<string, string>(); // note_id -> node_id

    // 为每个笔记创建节点
    for (const note of notes || []) {
      const { data: nodeData, error: nodeError } = await client
        .from("knowledge_nodes")
        .insert({
          type: "note",
          title: note.title,
          description: note.summary || note.content.substring(0, 200),
          note_id: note.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!nodeError && nodeData) {
        nodeMap.set(note.id, nodeData.id);
      }
    }

    // 为每个实体创建节点
    const entityMap = new Map<string, string>(); // entity_name -> node_id

    // 按实体名称分组
    const entityGroups = new Map<string, typeof entities>();
    for (const entity of entities || []) {
      if (!entityGroups.has(entity.entity_name)) {
        entityGroups.set(entity.entity_name, []);
      }
      entityGroups.get(entity.entity_name)?.push(entity);
    }

    for (const [entityName, entityList] of entityGroups) {
      const firstEntity = entityList[0];

      const { data: entityNodeData, error: entityNodeError } = await client
        .from("knowledge_nodes")
        .insert({
          type: "entity",
          title: entityName,
          description: firstEntity.description || `实体：${entityName}`,
          entity_name: entityName,
          metadata: {
            entityType: firstEntity.entity_type,
            count: entityList.length,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!entityNodeError && entityNodeData) {
        entityMap.set(entityName, entityNodeData.id);
      }
    }

    // 创建边：笔记 -> 实体
    for (const entity of entities || []) {
      const noteNodeId = nodeMap.get(entity.note_id);
      const entityNodeId = entityMap.get(entity.entity_name);

      if (noteNodeId && entityNodeId) {
        await client.from("knowledge_edges").insert({
          from_node_id: noteNodeId,
          to_node_id: entityNodeId,
          edge_type: "contains",
          weight: "1.00",
          created_at: new Date().toISOString(),
        });
      }
    }

    // 计算笔记之间的相似度并创建边
    // 基于共同实体的数量
    const noteEntitiesMap = new Map<string, Set<string>>(); // note_id -> Set<entity_name>

    for (const entity of entities || []) {
      if (!noteEntitiesMap.has(entity.note_id)) {
        noteEntitiesMap.set(entity.note_id, new Set());
      }
      noteEntitiesMap.get(entity.note_id)?.add(entity.entity_name);
    }

    const noteIds = Array.from(noteEntitiesMap.keys());

    for (let i = 0; i < noteIds.length; i++) {
      for (let j = i + 1; j < noteIds.length; j++) {
        const note1Id = noteIds[i];
        const note2Id = noteIds[j];

        const entities1 = noteEntitiesMap.get(note1Id) || new Set();
        const entities2 = noteEntitiesMap.get(note2Id) || new Set();

        // 计算交集
        const commonEntities = Array.from(entities1).filter((x) =>
          entities2.has(x)
        );

        if (commonEntities.length > 0) {
          const node1Id = nodeMap.get(note1Id);
          const node2Id = nodeMap.get(note2Id);

          if (node1Id && node2Id) {
            const weight = Math.min(1.0, commonEntities.length / 3); // 归一化权重

            await client.from("knowledge_edges").insert({
              from_node_id: node1Id,
              to_node_id: node2Id,
              edge_type: "similar",
              weight: weight.toFixed(2),
              metadata: {
                commonEntities: commonEntities,
                commonCount: commonEntities.length,
              },
              created_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    return NextResponse.json({
      message: "Knowledge graph synced successfully",
      stats: {
        notes: notes?.length || 0,
        entities: entityGroups.size,
        nodes: nodeMap.size + entityMap.size,
      },
    });
  } catch (error) {
    console.error("Error syncing knowledge graph:", error);
    return NextResponse.json(
      { error: "Failed to sync knowledge graph" },
      { status: 500 }
    );
  }
}
