"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Paper, PaperConnection } from "@/lib/supabase";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphData = {
  nodes: {
    id: string;
    title: string;
    category: string;
    isRead: boolean;
    val: number;
  }[];
  links: {
    source: string;
    target: string;
    strength: number;
  }[];
};

function buildGraphData(papers: Paper[], connections: PaperConnection[]): GraphData {
  const nodes = papers.map((p) => ({
    id: p.id,
    title: p.title,
    category: (p.categories as string[])?.[0] || "Uncategorized",
    isRead: p.is_read,
    val: 3,
  }));

  const nodeIds = new Set(papers.map((p) => p.id));
  const links = connections
    .filter((c) => nodeIds.has(c.paper_a) && nodeIds.has(c.paper_b))
    .map((c) => ({
      source: c.paper_a,
      target: c.paper_b,
      strength: c.strength,
    }));

  return { nodes, links };
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

  const graphData = buildGraphData(papers, connections);

  const handleNodeClick = useCallback(
    (node: { id?: string | number }) => {
      if (node.id) onSelectPaper(String(node.id));
    },
    [onSelectPaper]
  );

  const nodeCanvasObject = useCallback(
    (node: Record<string, unknown>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x as number;
      const y = node.y as number;
      const title = node.title as string;
      const isRead = node.isRead as boolean;
      const isSelected = node.id === selectedPaperId;
      const category = node.category as string;
      const radius = isSelected ? 8 : 5;

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? "#ffffff" : isRead ? "#cccccc" : "#666666";
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Label
      const fontSize = Math.max(11 / globalScale, 3);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      const label = title.length > 35 ? title.slice(0, 35) + "..." : title;

      // Text shadow
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x + 0.5, y + radius + 3 + 0.5);
      // Text
      ctx.fillStyle = isSelected ? "#ffffff" : "#999999";
      ctx.fillText(label, x, y + radius + 3);

      // Category label (smaller, dimmer)
      const catFontSize = Math.max(9 / globalScale, 2);
      ctx.font = `${catFontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = "#444444";
      ctx.fillText(category, x, y + radius + 3 + fontSize + 2);
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
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: Record<string, unknown>, color: string, ctx: CanvasRenderingContext2D) => {
          const x = node.x as number;
          const y = node.y as number;
          ctx.beginPath();
          ctx.arc(x, y, 12, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeClick={handleNodeClick}
        linkColor={() => "#333333"}
        linkWidth={(link: Record<string, unknown>) => ((link.strength as number) || 0.5) * 2}
        linkOpacity={0.4}
        backgroundColor="#000000"
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        enableNodeDrag={true}
      />
    </div>
  );
}
