import { NextRequest, NextResponse } from "next/server";
import { getApiClient } from "@/storage/database/supabase-client";

// GET /api/knowledge-graph - 获取知识图谱数据
export async function GET(request: NextRequest) {
  try {
    const client = getApiClient();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // note/entity/concept

    // 获取节点
    let nodesQuery = client.from("knowledge_nodes").select("*");
    if (type) {
      nodesQuery = nodesQuery.eq("type", type);
    }
    const { data: nodes, error: nodesError } = await nodesQuery;

    if (nodesError) {
      return NextResponse.json({ error: nodesError.message }, { status: 400 });
    }

    // 获取边
    const { data: edges, error: edgesError } = await client
      .from("knowledge_edges")
      .select("*");

    if (edgesError) {
      return NextResponse.json({ error: edgesError.message }, { status: 400 });
    }

    // 转换为前端需要的格式
    const formattedNodes = (nodes || []).map((node) => ({
      id: node.id,
      label: node.title,
      type: node.type,
      description: node.description,
      noteId: node.note_id,
      entityName: node.entity_name,
      metadata: node.metadata,
    }));

    const formattedEdges = (edges || []).map((edge) => ({
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
