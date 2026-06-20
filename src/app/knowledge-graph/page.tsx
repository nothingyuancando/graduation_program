"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  Node,
  NodeTypes,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Loader2, Network, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const nodeTypes: NodeTypes = {};

interface GraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  noteId?: string;
  entityName?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

function getNodePosition(index: number) {
  const radius = 260;
  const angle = index * 0.85;

  return {
    x: 420 + Math.cos(angle) * radius + (index % 3) * 36,
    y: 260 + Math.sin(angle) * radius,
  };
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchGraph = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/knowledge-graph");
      const data = await response.json();

      const formattedNodes: Node[] = (data.nodes || []).map((node: GraphNode, index: number) => ({
        id: node.id,
        position: getNodePosition(index),
        data: {
          label: node.label,
          type: node.type,
          description: node.description,
          noteId: node.noteId,
          entityName: node.entityName,
        },
        style: {
          background: node.type === "note" ? "#2563eb" : "#7c3aed",
          color: "#fff",
          border: "2px solid rgba(255,255,255,0.75)",
          borderRadius: "8px",
          width: 180,
          minHeight: 58,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "600",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.14)",
        },
      }));

      const formattedEdges: Edge[] = (data.edges || []).map((edge: GraphEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.type,
        animated: true,
        style: { stroke: "#94a3b8", strokeWidth: Math.max(1, edge.weight * 2) },
        data: { weight: edge.weight },
      }));

      setNodes(formattedNodes);
      setEdges(formattedEdges);
    } catch (error) {
      console.error("Error fetching graph:", error);
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    void fetchGraph();
  }, [fetchGraph]);

  const stats = useMemo(
    () => ({
      noteNodes: nodes.filter((node) => node.data.type === "note").length,
      entityNodes: nodes.filter((node) => node.data.type === "entity").length,
    }),
    [nodes]
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/knowledge-graph/sync", { method: "POST" });
      if (response.ok) await fetchGraph();
    } catch (error) {
      console.error("Error syncing graph:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <BackButton variant="ghost" size="sm">
<ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </BackButton>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">知识图谱</h1>
              <p className="text-sm text-muted-foreground">可视化知识关系与实体关联</p>
            </div>
          </div>

          <Button onClick={handleSync} disabled={syncing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "同步中..." : "同步图谱"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-500" />
                  关系网络
                </CardTitle>
                <CardDescription>
                  {loading ? "正在加载图谱数据" : `${nodes.length} 个节点，${edges.length} 条关系`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[600px] w-full overflow-hidden rounded-lg border bg-white">
                  {loading ? (
                    <div className="flex h-full items-center justify-center">
                      <div className="space-y-4 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">正在整理知识关系...</p>
                      </div>
                    </div>
                  ) : nodes.length ? (
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      nodeTypes={nodeTypes}
                      fitView
                    >
                      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                      <Controls />
                    </ReactFlow>
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center">
                      <div>
                        <Network className="mx-auto h-10 w-10 text-slate-300" />
                        <h2 className="mt-4 text-lg font-bold">暂无知识关系</h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          导入并分析笔记后，可以点击同步图谱生成实体与关系网络。
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>图例</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded bg-blue-600" />
                  <span className="text-sm">笔记节点</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded bg-purple-600" />
                  <span className="text-sm">实体节点</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-8 bg-slate-400" />
                  <span className="text-sm">关联关系</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>关系类型</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className="w-full justify-start">
                  contains - 包含
                </Badge>
                <Badge variant="outline" className="w-full justify-start">
                  similar - 相似
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>使用说明</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>拖拽节点调整位置</li>
                  <li>滚轮缩放画布</li>
                  <li>点击节点查看详情</li>
                  <li>点击“同步图谱”更新数据</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>统计信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <>
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">笔记节点</span>
                      <Badge variant="secondary">{stats.noteNodes}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">实体节点</span>
                      <Badge variant="secondary">{stats.entityNodes}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">关系边</span>
                      <Badge variant="secondary">{edges.length}</Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
