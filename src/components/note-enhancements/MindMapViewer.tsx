"use client";

import { useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "@/components/ui/button";
import { GitBranch, List } from "lucide-react";

interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  type?: string;
  children?: MindMapNode[];
}

interface Props {
  data: MindMapNode | null | undefined;
}

const DEPTH_COLORS = [
  { bg: "#0f172a", text: "#fff", border: "#020617" },
  { bg: "#2563eb", text: "#fff", border: "#1d4ed8" },
  { bg: "#059669", text: "#fff", border: "#047857" },
  { bg: "#d97706", text: "#fff", border: "#b45309" },
  { bg: "#be123c", text: "#fff", border: "#9f1239" },
];

const X_GAP = 260;
const Y_GAP = 125;

function colorAt(depth: number) {
  return DEPTH_COLORS[Math.min(depth, DEPTH_COLORS.length - 1)];
}

function countLeaves(node: MindMapNode): number {
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function nodeLabel(node: MindMapNode) {
  if (!node.description) return node.label;
  return `${node.label}\n${node.description}`;
}

function buildGraph(
  node: MindMapNode,
  depth: number,
  leafStart: number,
  nodes: Node[],
  edges: Edge[],
  parentId: string | null
) {
  const leaves = countLeaves(node);
  const x = (leafStart + leaves / 2) * X_GAP;
  const y = depth * Y_GAP;
  const { bg, text, border } = colorAt(depth);

  nodes.push({
    id: node.id,
    data: { label: nodeLabel(node) },
    position: { x: x - 105, y },
    style: {
      background: bg,
      color: text,
      border: `1px solid ${border}`,
      borderRadius: depth === 0 ? 26 : 14,
      padding: "10px 14px",
      fontSize: depth === 0 ? 15 : 12,
      fontWeight: depth <= 1 ? 700 : 500,
      width: depth <= 1 ? 220 : 240,
      textAlign: "center" as const,
      boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
      whiteSpace: "pre-wrap" as const,
      lineHeight: 1.35,
    },
  });

  if (parentId) {
    edges.push({
      id: `${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: "smoothstep",
      style: { stroke: colorAt(depth).bg, strokeWidth: 2.2 },
    });
  }

  let childLeafStart = leafStart;
  for (const child of node.children ?? []) {
    buildGraph(child, depth + 1, childLeafStart, nodes, edges, node.id);
    childLeafStart += countLeaves(child);
  }
}

function TreeTextView({ node, depth = 0 }: { node: MindMapNode; depth?: number }) {
  const [open, setOpen] = useState(true);
  const { bg } = colorAt(depth);
  const hasChildren = !!node.children?.length;

  return (
    <div className={depth > 0 ? "ml-5 mt-2" : ""}>
      <div
        className="flex items-start gap-2 cursor-pointer select-none"
        onClick={() => hasChildren && setOpen((value) => !value)}
      >
        {hasChildren && (
          <span className="mt-1 text-xs text-muted-foreground">
            {open ? "▼" : "▶"}
          </span>
        )}
        <div>
          <span
            className="inline-flex px-2.5 py-1 rounded-md text-white text-sm font-medium"
            style={{ background: bg }}
          >
            {node.label}
          </span>
          {node.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {node.description}
            </p>
          )}
        </div>
      </div>
      {open &&
        node.children?.map((child) => (
          <TreeTextView key={child.id} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

export function MindMapViewer({ data }: Props) {
  const [mode, setMode] = useState<"flow" | "tree">("flow");

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    const nextNodes: Node[] = [];
    const nextEdges: Edge[] = [];
    buildGraph(data, 0, 0, nextNodes, nextEdges, null);
    return { nodes: nextNodes, edges: nextEdges };
  }, [data]);

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        暂无思维导图数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          建议用图形视图看整体结构，用树形视图查看节点说明。
        </p>
        <div className="flex gap-2">
          <Button
            variant={mode === "flow" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("flow")}
          >
            <GitBranch className="h-4 w-4 mr-1" />
            图形视图
          </Button>
          <Button
            variant={mode === "tree" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("tree")}
          >
            <List className="h-4 w-4 mr-1" />
            树形视图
          </Button>
        </div>
      </div>

      {mode === "flow" ? (
        <div className="rounded-xl border overflow-hidden bg-white" style={{ height: 680 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.22 }}
            minZoom={0.15}
            maxZoom={1.6}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#cbd5e1" gap={22} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => (node.style?.background as string) ?? "#2563eb"}
              maskColor="rgba(15, 23, 42, 0.08)"
              style={{ height: 92 }}
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="p-5 rounded-xl border bg-card">
          <TreeTextView node={data} />
        </div>
      )}
    </div>
  );
}
