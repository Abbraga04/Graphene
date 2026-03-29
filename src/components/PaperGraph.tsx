"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Paper, PaperConnection } from "@/lib/supabase";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const CLUSTER_COLORS = [
  "rgba(99,130,255,0.12)", "rgba(255,130,99,0.12)", "rgba(99,255,170,0.12)",
  "rgba(255,220,99,0.12)", "rgba(190,99,255,0.12)", "rgba(99,210,255,0.12)",
  "rgba(255,99,170,0.12)", "rgba(170,255,99,0.12)",
];
const CLUSTER_STROKES = [
  "rgba(99,130,255,0.3)", "rgba(255,130,99,0.3)", "rgba(99,255,170,0.3)",
  "rgba(255,220,99,0.3)", "rgba(190,99,255,0.3)", "rgba(99,210,255,0.3)",
  "rgba(255,99,170,0.3)", "rgba(170,255,99,0.3)",
];

type GNode = {
  id: string;
  title: string;
  primaryCat: string;
  clusterIdx: number;
  isRead: boolean;
  x?: number;
  y?: number;
};

export default function PaperGraph({
  papers,
  connections,
  onSelectPaper,
  selectedPaperId,
}: {
  papers: Paper[];
  connections: PaperConnection[];
  onSelectPaper: (id: string) => void;
  selectedPaperId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const selectedRef = useRef(selectedPaperId);
  selectedRef.current = selectedPaperId;
  const hoveredRef = useRef<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDimensions({ width: el.clientWidth, height: el.clientHeight });
    update();
    let t: NodeJS.Timeout;
    const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(update, 150); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, []);

  const graphData = useMemo(() => {
    const catMap = new Map<string, number>();
    let idx = 0;
    const nodes: GNode[] = papers.map((p) => {
      const cats = (p.categories as string[]) || [];
      const primary = cats[0] || "Other";
      if (!catMap.has(primary)) catMap.set(primary, idx++);
      return {
        id: p.id,
        title: p.title,
        primaryCat: primary,
        clusterIdx: catMap.get(primary)!,
        isRead: p.is_read,
      };
    });
    const nodeIds = new Set(papers.map((p) => p.id));
    const links = connections
      .filter((c) => nodeIds.has(c.paper_a) && nodeIds.has(c.paper_b))
      .map((c) => ({ source: c.paper_a, target: c.paper_b }));
    return { nodes, links };
  }, [papers, connections]);

  // Zoom to fit once
  useEffect(() => {
    const t = setTimeout(() => graphRef.current?.zoomToFit(300, 60), 1500);
    return () => clearTimeout(t);
  }, [graphData]);

  const handleClick = useCallback((node: any) => {
    if (node?.id) onSelectPaper(String(node.id));
  }, [onSelectPaper]);

  // Venn circles behind nodes
  const paintBefore = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    const clusters = new Map<number, { pts: { x: number; y: number }[]; cat: string }>();
    for (const n of graphData.nodes) {
      if (n.x == null || n.y == null) continue;
      const c = clusters.get(n.clusterIdx) || { pts: [], cat: n.primaryCat };
      c.pts.push({ x: n.x, y: n.y });
      clusters.set(n.clusterIdx, c);
    }
    clusters.forEach(({ pts, cat }, idx) => {
      if (!pts.length) return;
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      let maxD = 0;
      for (const p of pts) {
        const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
        if (d > maxD) maxD = d;
      }
      const r = Math.min(Math.max(maxD + 40, 60), 200);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = CLUSTER_STROKES[idx % CLUSTER_STROKES.length];
      ctx.lineWidth = 1;
      ctx.stroke();
      const fs = Math.max(12 / globalScale, 4);
      ctx.font = `700 ${fs}px JetBrains Mono, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = CLUSTER_STROKES[idx % CLUSTER_STROKES.length];
      ctx.fillText(cat.toUpperCase(), cx, cy - r + fs + 4);
    });
  }, [graphData.nodes]);

  // Node rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x as number, y = node.y as number;
    const isSel = node.id === selectedRef.current;
    const isHov = node.id === hoveredRef.current;
    const r = isSel ? 10 : isHov ? 8 : 6;

    // Outer ring on hover/select
    if (isSel || isHov) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
    }

    // Main circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isSel ? "#fff" : node.isRead ? "#bbb" : "#777";
    ctx.fill();
    ctx.strokeStyle = isSel ? "#fff" : "rgba(255,255,255,0.25)";
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.stroke();

    // Label
    ctx.textAlign = "center";
    if (isSel || isHov) {
      const fs = Math.max(12 / globalScale, 5);
      ctx.font = `600 ${fs}px JetBrains Mono, monospace`;
      const label = node.title.length > 50 ? node.title.slice(0, 50) + "..." : node.title;
      const m = ctx.measureText(label);
      ctx.fillStyle = "rgba(0,0,0,0.92)";
      ctx.fillRect(x - m.width / 2 - 5, y - r - fs - 10, m.width + 10, fs + 6);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, x, y - r - 7);
    } else {
      const fs = Math.max(8 / globalScale, 2.5);
      ctx.font = `${fs}px JetBrains Mono, monospace`;
      const short = node.title.length > 20 ? node.title.slice(0, 20) + "..." : node.title;
      ctx.fillStyle = "#bbb";
      ctx.fillText(short, x, y + r + fs + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (papers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 font-mono text-neutral-700">&lt;/&gt;</div>
          <p className="text-sm tracking-widest uppercase text-neutral-600">No papers yet</p>
          <p className="text-xs text-neutral-700 mt-2">Add a paper to begin mapping</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: "#000" }}>
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeClick={handleClick}
        onNodeHover={(node: any) => {
          hoveredRef.current = node?.id || null;
          if (containerRef.current) containerRef.current.style.cursor = node ? "pointer" : "grab";
        }}
        enableNodeDrag={false}
        onRenderFramePre={paintBefore}
        linkColor={() => "rgba(255,255,255,0.06)"}
        linkWidth={1}
        backgroundColor="#000000"
        warmupTicks={80}
        cooldownTicks={80}
        d3AlphaDecay={0.04}
        d3VelocityDecay={0.4}
        {...{
          d3Force: "charge",
          d3ForceConfig: {
            charge: { strength: -120, distanceMax: 150 },
            link: { distance: 45 },
            center: { strength: 0.08 },
          },
        } as any}
      />
    </div>
  );
}
