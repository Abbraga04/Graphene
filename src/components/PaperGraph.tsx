"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Paper, PaperConnection } from "@/lib/supabase";
import { humanCategory } from "@/lib/categories";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

// Muted color palette for clusters
const CLUSTER_COLORS = [
  { node: "#8b9cf7", bg: "rgba(139,156,247,0.06)", border: "rgba(139,156,247,0.15)" },
  { node: "#f7a08b", bg: "rgba(247,160,139,0.06)", border: "rgba(247,160,139,0.15)" },
  { node: "#8bf7c4", bg: "rgba(139,247,196,0.06)", border: "rgba(139,247,196,0.15)" },
  { node: "#f7e88b", bg: "rgba(247,232,139,0.06)", border: "rgba(247,232,139,0.15)" },
  { node: "#c98bf7", bg: "rgba(201,139,247,0.06)", border: "rgba(201,139,247,0.15)" },
  { node: "#8bd4f7", bg: "rgba(139,212,247,0.06)", border: "rgba(139,212,247,0.15)" },
  { node: "#f78bb8", bg: "rgba(247,139,184,0.06)", border: "rgba(247,139,184,0.15)" },
  { node: "#b8f78b", bg: "rgba(184,247,139,0.06)", border: "rgba(184,247,139,0.15)" },
];

type GraphNode = {
  id: string;
  title: string;
  category: string;
  categoryLabel: string;
  clusterIdx: number;
  isRead: boolean;
  val: number;
  x?: number;
  y?: number;
};

type GraphLink = {
  source: string;
  target: string;
  strength: number;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

function buildGraphData(papers: Paper[], connections: PaperConnection[]): { data: GraphData; categories: string[] } {
  const categoryMap = new Map<string, number>();
  const categoryList: string[] = [];
  let idx = 0;

  const nodes: GraphNode[] = papers.map((p) => {
    const cats = p.categories as string[];
    const primaryCat = cats?.[0] || "Uncategorized";
    if (!categoryMap.has(primaryCat)) {
      categoryMap.set(primaryCat, idx++);
      categoryList.push(primaryCat);
    }
    const clusterIdx = categoryMap.get(primaryCat)!;
    return {
      id: p.id,
      title: p.title,
      category: primaryCat,
      categoryLabel: humanCategory(primaryCat),
      clusterIdx,
      isRead: p.is_read,
      val: 4,
    };
  });

  const nodeIds = new Set(papers.map((p) => p.id));
  const links = connections
    .filter((c) => nodeIds.has(c.paper_a) && nodeIds.has(c.paper_b))
    .map((c) => ({
      source: c.paper_a,
      target: c.paper_b,
      strength: c.strength,
    }));

  return { data: { nodes, links }, categories: categoryList };
}

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
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const { data: graphData, categories } = useMemo(
    () => buildGraphData(papers, connections),
    [papers, connections]
  );

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      if (node.id) onSelectPaper(String(node.id));
    },
    [onSelectPaper]
  );

  // Draw cluster backgrounds behind nodes
  const onRenderFramePre = useCallback(
    (ctx: CanvasRenderingContext2D, globalScale: number) => {
      // Group nodes by cluster
      const clusters = new Map<number, { nodes: GraphNode[]; label: string }>();
      for (const node of graphData.nodes) {
        if (node.x == null || node.y == null) continue;
        const existing = clusters.get(node.clusterIdx);
        if (existing) {
          existing.nodes.push(node);
        } else {
          clusters.set(node.clusterIdx, { nodes: [node], label: node.categoryLabel });
        }
      }

      clusters.forEach((cluster, idx) => {
        const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
        const nodes = cluster.nodes;
        if (nodes.length === 0) return;

        // Calculate bounding box with padding
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of nodes) {
          if (n.x! < minX) minX = n.x!;
          if (n.x! > maxX) maxX = n.x!;
          if (n.y! < minY) minY = n.y!;
          if (n.y! > maxY) maxY = n.y!;
        }

        const pad = 40;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) / 2 + pad;
        const ry = (maxY - minY) / 2 + pad;

        // Draw cluster ellipse background
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 30), Math.max(ry, 30), 0, 0, 2 * Math.PI);
        ctx.fillStyle = color.bg;
        ctx.fill();
        ctx.strokeStyle = color.border;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Cluster label at top
        const labelSize = Math.max(14 / globalScale, 5);
        ctx.font = `600 ${labelSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = color.border.replace("0.15", "0.5");
        ctx.fillText(cluster.label.toUpperCase(), cx, cy - Math.max(ry, 30) - 5);
      });
    },
    [graphData.nodes]
  );

  const nodeCanvasObject = useCallback(
    (node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x as number;
      const y = node.y as number;
      const title = node.title as string;
      const isRead = node.isRead as boolean;
      const isSelected = node.id === selectedPaperId;
      const clusterIdx = node.clusterIdx as number;
      const color = CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length];
      const radius = isSelected ? 8 : 5;

      // Glow for selected
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, 2 * Math.PI);
        ctx.fillStyle = color.node.replace(")", ",0.2)").replace("rgb", "rgba");
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#ffffff" : isRead ? color.node : color.node.replace(")", ",0.6)").replace("rgb", "rgba");
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Title label
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const label = title.length > 40 ? title.slice(0, 40) + "..." : title;

      // Text shadow
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillText(label, x + 0.3, y + radius + 3 + 0.3);
      // Text
      ctx.fillStyle = isSelected ? "#ffffff" : "#aaaaaa";
      ctx.fillText(label, x, y + radius + 3);
    },
    [selectedPaperId]
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
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D) => {
          const x = node.x as number;
          const y = node.y as number;
          ctx.beginPath();
          ctx.arc(x, y, 14, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        onRenderFramePre={onRenderFramePre}
        linkColor={() => "#333333"}
        linkWidth={(link: Record<string, unknown>) => ((link.strength as number) || 0.5) * 1.5}
        linkOpacity={0.3}
        linkLineDash={() => [2, 2]}
        backgroundColor="#000000"
        cooldownTime={3000}
        d3AlphaDecay={0.015}
        d3VelocityDecay={0.25}
        enableNodeDrag={true}
      />
    </div>
  );
}
