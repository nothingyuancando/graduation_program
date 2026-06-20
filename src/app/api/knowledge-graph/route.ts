import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/knowledge-graph - 获取知识图谱数据
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const client = getApiClient();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // note/entity/concept

    const { data: userNotes, error: notesError } = await client
      .from("notes")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 400 });
    }

    const noteIds = (userNotes || []).map((note) => note.id);
    if (noteIds.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const { data: userEntities, error: entitiesError } = await client
      .from("note_entities")
      .select("entity_name")
      .in("note_id", noteIds);

    if (entitiesError) {
      return NextResponse.json({ error: entitiesError.message }, { status: 400 });
    }

    const entityNames = Array.from(
      new Set((userEntities || []).map((entity) => entity.entity_name).filter(Boolean))
    );

    const nodeResults = [];

    if (!type || type === "note") {
      const { data: noteNodes, error: noteNodesError } = await client
        .from("knowledge_nodes")
        .select("*")
        .in("note_id", noteIds);

      if (noteNodesError) {
        return NextResponse.json({ error: noteNodesError.message }, { status: 400 });
      }
      nodeResults.push(...(noteNodes || []));
    }

    if (entityNames.length > 0 && (!type || type === "entity" || type === "concept")) {
      let entityNodesQuery = client
        .from("knowledge_nodes")
        .select("*")
        .in("entity_name", entityNames);

      if (type) {
        entityNodesQuery = entityNodesQuery.eq("type", type);
      }

      const { data: entityNodes, error: entityNodesError } = await entityNodesQuery;
      if (entityNodesError) {
        return NextResponse.json({ error: entityNodesError.message }, { status: 400 });
      }
      nodeResults.push(...(entityNodes || []));
    }

    const uniqueNodes = Array.from(new Map(nodeResults.map((node) => [node.id, node])).values());

    const visibleNodeIds = new Set(uniqueNodes.map((node) => node.id));

    const { data: edges, error: edgesError } = await client
      .from("knowledge_edges")
      .select("*");

    if (edgesError) {
      return NextResponse.json({ error: edgesError.message }, { status: 400 });
    }

    // 转换为前端需要的格式
    const formattedNodes = uniqueNodes.map((node) => ({
      id: node.id,
      label: node.title,
      type: node.type,
      description: node.description,
      noteId: node.note_id,
      entityName: node.entity_name,
      metadata: node.metadata,
    }));

    const formattedEdges = (edges || [])
      .filter((edge) => visibleNodeIds.has(edge.from_node_id) && visibleNodeIds.has(edge.to_node_id))
      .map((edge) => ({
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        type: edge.edge_type,
        weight: parseFloat(edge.weight),
        metadata: edge.metadata,
      }));

    return NextResponse.json({
      nodes: formattedNodes,
      edges: formattedEdges,
    });
  } catch (error) {
    console.error("Error fetching knowledge graph:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
