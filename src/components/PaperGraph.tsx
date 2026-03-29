"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Paper, PaperConnection } from "@/lib/supabase";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const CLUSTER_COLORS: Record<string, { fill: string; stroke: string; node: string }> = {};
const COLOR_PALETTE = [
  { fill: "rgba(99,130,255,0.07)", stroke: "rgba(99,130,255,0.25)", node: "#6382ff" },
  { fill: "rgba(255,130,99,0.07)", stroke: "rgba(255,130,99,0.25)", node: "#ff8263" },
  { fill: "rgba(99,255,170,0.07)", stroke: "rgba(99,255,170,0.25)", node: "#63ffaa" },
  { fill: "rgba(255,220,99,0.07)", stroke: "rgba(255,220,99,0.25)", node: "#ffdc63" },
  { fill: "rgba(190,99,255,0.07)", stroke: "rgba(190,99,255,0.25)", node: "#be63ff" },
  { fill: "rgba(99,210,255,0.07)", stroke: "rgba(99,210,255,0.25)", node: "#63d2ff" },
  { fill: "rgba(255,99,170,0.07)", stroke: "rgba(255,99,170,0.25)", node: "#ff63aa" },
  { fill: "rgba(170,255,99,0.07)", stroke: "rgba(170,255,99,0.25)", node: "#aaff63" },
];

let colorIdx = 0;
function getClusterColor(cat: string) {
  if (!CLUSTER_COLORS[cat]) {
    CLUSTER_COLORS[cat] = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length];
    colorIdx++;
  }
  return CLUSTER_COLORS[cat];
}

type GNode = {
  id: string;
  title: string;
  categories: string[];
  primaryCat: string;
  isRead: boolean;
  val: number;
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
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      setDimensions({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    updateSize();

    // Debounced ResizeObserver to avoid simulation restarts
    let timeout: NodeJS.Timeout;
    const ro = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(updateSize, 100);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timeout); };
  }, []);

  const graphData = useMemo(() => {
    // Reset colors on rebuild
    colorIdx = 0;
    Object.keys(CLUSTER_COLORS).forEach((k) => delete CLUSTER_COLORS[k]);

    const nodes: GNode[] = papers.map((p) => {
      const cats = (p.categories as string[]) || [];
      const primaryCat = cats[0] || "Uncategorized";
      getClusterColor(primaryCat);
      return {
        id: p.id,
        title: p.title,
        categories: cats,
        primaryCat,
        isRead: p.is_read,
        val: 5,
      };
    });

    const nodeIds = new Set(papers.map((p) => p.id));
    const links = connections
      .filter((c) => nodeIds.has(c.paper_a) && nodeIds.has(c.paper_b))
      .map((c) => ({ source: c.paper_a, target: c.paper_b }));

    return { nodes, links };
  }, [papers, connections]);

  // Zoom to fit after layout settles
  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(400, 80);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [graphData]);

  const handleNodeClick = useCallback(
    (node: any) => {
      if (node.id) onSelectPaper(String(node.id));
    },
    [onSelectPaper]
  );

  // Draw venn diagram regions behind nodes
  const paintBefore = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Group nodes by primary category
      const clusters = new Map<string, { x: number; y: number }[]>();
      for (const node of graphData.nodes) {
        if (node.x == null || node.y == null) continue;
        const pts = clusters.get(node.primaryCat) || [];
        pts.push({ x: node.x, y: node.y });
        clusters.set(node.primaryCat, pts);
      }

      clusters.forEach((points, cat) => {
        if (points.length === 0) return;
        const color = getClusterColor(cat);

        // Calculate center and radius
        const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
        const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
        let maxDist = 0;
        for (const p of points) {
          const d = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
          if (d > maxDist) maxDist = d;
        }
        const radius = Math.min(Math.max(maxDist + 35, 50), 150);

        // Draw filled circle (venn region)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color.fill;
        ctx.fill();
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Category label
        const fontSize = Math.max(14 / globalScale, 5);
        ctx.font = `600 ${fontSize}px JetBrains Mono, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = color.stroke;
        ctx.fillText(cat.toUpperCase(), cx, cy - radius + fontSize + 2);
      });
    },
    [graphData.nodes]
  );

  // Custom node rendering
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x as number;
      const y = node.y as number;
      const isSelected = node.id === selectedRef.current;
      const color = getClusterColor(node.primaryCat);
      const r = isSelected ? 6 : 4;

      // Glow
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = color.fill.replace("0.07", "0.3");
        ctx.fill();
      }

      // Node dot
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#ffffff" : node.isRead ? color.node : color.node + "99";
      ctx.fill();

      // Title
      const fontSize = Math.max(9 / globalScale, 2.5);
      ctx.font = `${fontSize}px JetBrains Mono, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = node.title.length > 35 ? node.title.slice(0, 35) + "..." : node.title;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillText(label, x + 0.3, y + r + 2.5 + 0.3);
      ctx.fillStyle = isSelected ? "#ffffff" : "#bbbbbb";
      ctx.fillText(label, x, y + r + 2.5);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
          ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        onRenderFramePre={paintBefore}
        linkColor={() => "rgba(255,255,255,0.08)"}
        linkWidth={1}
        backgroundColor="#000000"
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        d3Force="charge"
        d3ForceConfig={{
          charge: { strength: -200, distanceMax: 400 },
          link: { distance: 60 },
        }}
      />
    </div>
  );
}
