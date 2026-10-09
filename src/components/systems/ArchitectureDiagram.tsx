"use client";

import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import "@xyflow/react/dist/base.css";
import { useMemo, useState } from "react";
import {
  BaseEdge,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { ArchEdge, ArchNode } from "@/content/projects";
import { cx } from "@/components/ui/primitives";

type NodeData = ArchNode & { selected: boolean };

const kindStyle: Record<NonNullable<ArchNode["kind"]>, string> = {
  input: "border-line-strong text-fg-muted",
  output: "border-accent/60 text-fg",
  model: "border-accent/40 text-fg bg-accent-soft",
  store: "border-line-strong text-fg",
  logic: "border-line-strong text-fg",
  human: "border-ok/50 text-fg",
};
const kindLabel: Record<NonNullable<ArchNode["kind"]>, string> = {
  input: "Input",
  output: "Output",
  model: "Model",
  store: "Retrieval / store",
  logic: "Deterministic logic",
  human: "Human in the loop",
};

function SystemNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <div
      className={cx(
        "min-w-[120px] rounded-input border bg-bg-raised px-3 py-2 text-center text-[12px] leading-tight transition-shadow",
        kindStyle[data.kind ?? "logic"],
        data.selected && "shadow-[0_0_0_2px_var(--accent)]",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line-strong" />
      {data.label}
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line-strong" />
    </div>
  );
}

function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, data }: EdgeProps<Edge<{ animate: boolean; delay: number }>>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: "rgba(20,32,74,0.18)", strokeWidth: 1.2 }} />
      {data?.animate ? (
        <circle r={2.6} fill="var(--accent)">
          <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${data.delay}s`} path={path} />
        </circle>
      ) : null}
      {label ? (
        <foreignObject x={lx - 40} y={ly - 22} width={80} height={16} className="pointer-events-none overflow-visible">
          <div className="text-center font-mono text-[10px] text-fg-faint">{label}</div>
        </foreignObject>
      ) : null}
    </>
  );
}

const nodeTypes = { system: SystemNode };
const edgeTypes = { flow: FlowEdge };

export function ArchitectureDiagram({ nodes, edges, height = 340, title }: { nodes: ArchNode[]; edges: ArchEdge[]; height?: number; title: string }) {
  const reduce = useReducedMotionSafe();
  const [selected, setSelected] = useState<string | null>(null);

  const { rfNodes, rfEdges } = useMemo(() => {
    const byStage = new Map<number, ArchNode[]>();
    nodes.forEach((n) => byStage.set(n.stage, [...(byStage.get(n.stage) ?? []), n]));
    const colW = 170;
    const rowH = 74;
    const rfNodes: Node<NodeData>[] = nodes.map((n) => {
      const col = byStage.get(n.stage)!;
      const idx = col.indexOf(n);
      return {
        id: n.id,
        type: "system",
        position: { x: n.stage * colW, y: (idx - (col.length - 1) / 2) * rowH },
        data: { ...n, selected: n.id === selected },
        draggable: false,
        connectable: false,
      };
    });
    const rfEdges: Edge<{ animate: boolean; delay: number }>[] = edges.map((e, i) => ({
      id: `${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: "flow",
      label: e.label,
      data: { animate: !reduce, delay: (i % 5) * 0.45 },
    }));
    return { rfNodes, rfEdges };
  }, [nodes, edges, selected, reduce]);

  const current = nodes.find((n) => n.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="overflow-hidden rounded-card border border-line bg-bg-raised" style={{ height }} data-lenis-prevent>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.4}
          maxZoom={1.6}
          onNodeClick={(_, n) => setSelected((s) => (s === n.id ? null : n.id))}
          onPaneClick={() => setSelected(null)}
          aria-label={`${title} architecture diagram`}
          colorMode="light"
        />
      </div>
      <div className="rounded-card border border-line bg-bg-raised p-4" aria-live="polite">
        {current ? (
          <>
            <div className="font-mono text-[11px] text-accent">{kindLabel[current.kind ?? "logic"]}</div>
            <div className="mt-1.5 text-base font-medium text-fg">{current.label}</div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{current.detail}</p>
          </>
        ) : (
          <>
            <div className="text-sm text-fg">How it fits together</div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">Select a component to see what it does. Blue packets show the direction data moves.</p>
          </>
        )}
        {/* Text alternative for the diagram */}
        <ul className="sr-only">
          {edges.map((e) => (
            <li key={`${e.from}-${e.to}`}>
              {nodes.find((n) => n.id === e.from)?.label} to {nodes.find((n) => n.id === e.to)?.label}
              {e.label ? ` (${e.label})` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
