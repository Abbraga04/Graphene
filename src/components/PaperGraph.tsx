"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Paper, PaperConnection } from "@/lib/supabase";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const CLUSTER_COLORS = [
  "#8b9cf7", "#f7a08b", "#8bf7c4", "#f7e88b",
  "#c98bf7", "#8bd4f7", "#f78bb8", "#b8f78b",
  "#f7c68b", "#8bf7f0", "#d4f78b", "#f78b8b",
];

type GraphNode = {
  id: string;
  title: string;
  category: string;
  clusterIdx: number;
  isRead: boolean;
  val: number;
  color: string;
};

type GraphLink = {
  source: string;
  target: string;
  strength: number;
};

function buildGraphData(papers: Paper[], connections: PaperConnection[]) {
  const categoryMap = new Map<string, number>();
  let idx = 0;

  const nodes: GraphNode[] = papers.map((p) => {
    const cats = p.categories as string[];
    const primaryCat = cats?.[0] || "Uncategorized";
    if (!categoryMap.has(primaryCat)) {
      categoryMap.set(primaryCat, idx++);
    }
    const clusterIdx = categoryMap.get(primaryCat)!;
    return {
      id: p.id,
      title: p.title,
      category: primaryCat,
      clusterIdx,
      isRead: p.is_read,
      val: 6,
      color: CLUSTER_COLORS[clusterIdx % CLUSTER_COLORS.length],
    };
  });

  const nodeIds = new Set(papers.map((p) => p.id));
  const links: GraphLink[] = connections
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

  const graphData = useMemo(() => buildGraphData(papers, connections), [papers, connections]);

  const handleNodeClick = useCallback(
    (node: any) => {
      if (node.id) onSelectPaper(String(node.id));
    },
    [onSelectPaper]
  );

  // Create text sprite for node labels
  const nodeThreeObject = useCallback(
    (node: any) => {
      const THREE = require("three");
      const group = new THREE.Group();

      // Sphere
      const isSelected = node.id === selectedPaperId;
      const geo = new THREE.SphereGeometry(isSelected ? 3 : 2, 16, 16);
      const mat = new THREE.MeshLambertMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: isSelected ? 0.5 : 0.15,
        transparent: true,
        opacity: node.isRead ? 1 : 0.7,
      });
      const sphere = new THREE.Mesh(geo, mat);
      group.add(sphere);

      // Label sprite
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      canvas.width = 1024;
      canvas.height = 128;
      ctx.clearRect(0, 0, 1024, 128);

      // Title
      ctx.font = "bold 28px JetBrains Mono, monospace";
      ctx.fillStyle = isSelected ? "#ffffff" : "#cccccc";
      ctx.textAlign = "center";
      const label = node.title.length > 50 ? node.title.slice(0, 50) + "..." : node.title;
      ctx.fillText(label, 512, 45);

      // Category
      ctx.font = "20px JetBrains Mono, monospace";
      ctx.fillStyle = node.color;
      ctx.fillText(node.category, 512, 85);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(40, 5, 1);
      sprite.position.set(0, 5, 0);
      group.add(sprite);

      return group;
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
      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        onEngineStop={() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(500, 60);
          }
        }}
        linkColor={() => "#333333"}
        linkWidth={(link: any) => (link.strength || 0.5) * 1.5}
        linkOpacity={0.3}
        backgroundColor="#000000"
        showNavInfo={false}
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        d3Force="charge"
        d3ForceConfig={{
          charge: { strength: -80, distanceMax: 150 },
          link: { distance: 30 },
          center: { strength: 1 },
        }}
      />
    </div>
  );
}
