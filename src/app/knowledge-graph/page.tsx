"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Network, Loader2 } from "lucide-react";

const nodeTypes: NodeTypes = {};

interface GraphNode {
  id: string;
  label: string;
  type: string;
  description?: string;
  noteId?: string;
  entityName?: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
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

      const formattedNodes: Node[] = (data.nodes || []).map((node: GraphNode) => ({
        id: node.id,
        position: { x: Math.random() * 800, y: Math.random() * 600 },
        data: {
          label: node.label,
          type: node.type,
          description: node.description,
          noteId: node.noteId,
          entityName: node.entityName,
        },
        style: {
          background: node.type === "note" ? "#3b82f6" : "#8b5cf6",
          color: "#fff",
          border: "2px solid",
          borderColor: node.type === "note" ? "#2563eb" : "#7c3aed",
          borderRadius: "8px",
          width: 180,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: "500",
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
    fetchGraph();
  }, [fetchGraph]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/knowledge-graph/sync", {
        method: "POST",
      });

      const data = await response.json();
      if (data.message) {
        await fetchGraph();
      }
    } catch (error) {
      console.error("Error syncing graph:", error);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  杩斿洖
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold">鐭ヨ瘑鍥捐氨</h1>
                <p className="text-sm text-muted-foreground">鍙鍖栫煡璇嗗叧绯讳笌瀹炰綋鍏宠仈</p>
              </div>
            </div>

            <Button onClick={handleSync} disabled={syncing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "鍚屾涓?.." : "鍚屾鍥捐氨"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Graph Visualization */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-5 w-5 text-purple-500" />
                  鍏崇郴缃戠粶
                </CardTitle>
                <CardDescription>
                  {nodes.length} 涓妭鐐? {edges.length} 鏉¤竟
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[600px] border rounded-lg overflow-hidden bg-white dark:bg-slate-800">
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
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Legend & Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>鍥句緥</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span className="text-sm">绗旇鑺傜偣</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-purple-500" />
                  <span className="text-sm">瀹炰綋鑺傜偣</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-0.5 bg-slate-400" />
                  <span className="text-sm">鍏宠仈鍏崇郴</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>鍏崇郴绫诲瀷</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Badge variant="outline" className="w-full justify-start">
                  contains - 鍖呭惈
                </Badge>
                <Badge variant="outline" className="w-full justify-start">
                  similar - 鐩镐技
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>浣跨敤璇存槑</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>鈥?鎷栨嫿鑺傜偣璋冩暣浣嶇疆</li>
                  <li>鈥?婊氳疆缂╂斁鐢诲竷</li>
                  <li>鈥?鐐瑰嚮鑺傜偣鏌ョ湅璇︽儏</li>
                  <li>鈥?鐐瑰嚮&quot;鍚屾鍥捐氨&quot;鏇存柊鏁版嵁</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>缁熻淇℃伅</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">绗旇鑺傜偣</span>
                  <Badge variant="secondary">
                    {nodes.filter((n) => n.data.type === "note").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">瀹炰綋鑺傜偣</span>
                  <Badge variant="secondary">
                    {nodes.filter((n) => n.data.type === "entity").length}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">关系边</span>
                  <Badge variant="secondary">{edges.length}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

