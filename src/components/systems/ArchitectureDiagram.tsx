"use client";

import { useReducedMotionSafe } from "@/lib/useReducedMotionSafe";
import "@xyflow/react/dist/base.css";
import { useEffect, useMemo, useRef, useState } from "react";
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
  type ReactFlowInstance,
} from "@xyflow/react";
import type { ArchEdge, ArchNode } from "@/content/projects";
import { cx } from "@/components/ui/primitives";

type NodeData = ArchNode & { selected: boolean; vertical: boolean };

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
        "min-w-[128px] rounded-input border bg-bg-raised px-3 py-2 text-center text-[13px] leading-tight transition-shadow",
        kindStyle[data.kind ?? "logic"],
        data.selected && "shadow-[0_0_0_2px_var(--accent)]",
      )}
    >
      <Handle type="target" position={data.vertical ? Position.Top : Position.Left} className="!size-1.5 !border-0 !bg-line-strong" />
      {data.label}
      <Handle type="source" position={data.vertical ? Position.Bottom : Position.Right} className="!size-1.5 !border-0 !bg-line-strong" />
    </div>
  );
}

function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, data }: EdgeProps<Edge<{ animate: boolean; delay: number }>>) {
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: "rgba(65, 51, 51,0.18)", strokeWidth: 1.2 }} />
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

  // Fit to the container: re-fit on every resize, and lay out top-to-bottom when narrow.
  const box = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance<Node<NodeData>, Edge<{ animate: boolean; delay: number }>> | null>(null);
  const [vertical, setVertical] = useState(false);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setVertical(entry.contentRect.width < 560);
      setBoxWidth(entry.contentRect.width);
      requestAnimationFrame(() => flow.current?.fitView({ padding: 0.12, duration: 0 }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stageCount = Math.max(...nodes.map((n) => n.stage)) + 1;
  const maxPerStage = Math.max(...Array.from({ length: stageCount }, (_, i) => nodes.filter((n) => n.stage === i).length));
  // Height follows the diagram's own proportions so fitView fills the box instead of shrinking.
  const layoutW = (stageCount - 1) * 170 + 170;
  const layoutH = (maxPerStage - 1) * 74 + 90;
  const boxHeight = vertical
    ? Math.min(820, 100 + stageCount * 88)
    : boxWidth
      ? Math.round(Math.min(height, Math.max(220, (boxWidth * layoutH) / layoutW + 60)))
      : height;

  const { rfNodes, rfEdges } = useMemo(() => {
    const byStage = new Map<number, ArchNode[]>();
    nodes.forEach((n) => byStage.set(n.stage, [...(byStage.get(n.stage) ?? []), n]));
    const colW = 170;
    const rowH = 74;
    const rfNodes: Node<NodeData>[] = nodes.map((n) => {
      const col = byStage.get(n.stage)!;
      const idx = col.indexOf(n);
      const across = idx - (col.length - 1) / 2;
      return {
        id: n.id,
        type: "system",
        position: vertical ? { x: across * 150, y: n.stage * 88 } : { x: n.stage * colW, y: across * rowH },
        data: { ...n, selected: n.id === selected, vertical },
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
  }, [nodes, edges, selected, reduce, vertical]);

  const current = nodes.find((n) => n.id === selected);

  return (
    <div className="grid gap-3">
      <div ref={box} className="overflow-hidden rounded-card border border-line bg-bg-raised" style={{ height: boxHeight }} data-lenis-prevent>
        <ReactFlow
          key={vertical ? "v" : "h"}
          onInit={(inst) => {
            flow.current = inst;
          }}
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.2}
          maxZoom={1.4}
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
