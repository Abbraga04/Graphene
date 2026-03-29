"use client";

import { useRef, useMemo, useState, useCallback } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import { Paper, PaperConnection } from "@/lib/supabase";

type GraphNode = {
  id: string;
  title: string;
  categories: string[];
  isRead: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  cluster: number;
  clusterName: string;
};

type GraphEdge = {
  source: string;
  target: string;
  strength: number;
};

function buildGraph(papers: Paper[], connections: PaperConnection[]) {
  const categoryMap = new Map<string, number>();
  let clusterIdx = 0;

  const nodes: GraphNode[] = papers.map((p) => {
    const cats = p.categories as string[];
    const primaryCat = cats?.[0] || "Uncategorized";
    if (!categoryMap.has(primaryCat)) {
      categoryMap.set(primaryCat, clusterIdx++);
    }
    const cluster = categoryMap.get(primaryCat)!;
    const total = Math.max(clusterIdx, 1);
    const angle = (cluster / total) * Math.PI * 2;
    const radius = 12;
    return {
      id: p.id,
      title: p.title,
      categories: cats || [],
      isRead: p.is_read,
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 6,
      y: (Math.random() - 0.5) * 6,
      z: Math.sin(angle) * radius + (Math.random() - 0.5) * 6,
      vx: 0, vy: 0, vz: 0,
      cluster,
      clusterName: primaryCat,
    };
  });

  const edges: GraphEdge[] = connections.map((c) => ({
    source: c.paper_a,
    target: c.paper_b,
    strength: c.strength,
  }));

  return { nodes, edges };
}

function simulateForces(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const damping = 0.9;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.5;
      const force = 3.0 / (dist * dist);
      a.vx += (dx / dist) * force; a.vy += (dy / dist) * force; a.vz += (dz / dist) * force;
      b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force; b.vz -= (dz / dist) * force;
    }
  }

  for (const edge of edges) {
    const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
    const force = (dist - 4) * 0.04 * edge.strength;
    a.vx += (dx / dist) * force; a.vy += (dy / dist) * force; a.vz += (dz / dist) * force;
    b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force; b.vz -= (dz / dist) * force;
  }

  const clusters = new Map<number, { x: number; y: number; z: number; n: number }>();
  for (const n of nodes) {
    const c = clusters.get(n.cluster) || { x: 0, y: 0, z: 0, n: 0 };
    c.x += n.x; c.y += n.y; c.z += n.z; c.n++;
    clusters.set(n.cluster, c);
  }
  for (const n of nodes) {
    const c = clusters.get(n.cluster)!;
    n.vx += (c.x / c.n - n.x) * 0.005;
    n.vy += (c.y / c.n - n.y) * 0.005;
    n.vz += (c.z / c.n - n.z) * 0.005;
  }

  for (const n of nodes) {
    n.vx *= damping; n.vy *= damping; n.vz *= damping;
    n.x += n.vx * 0.02; n.y += n.vy * 0.02; n.z += n.vz * 0.02;
  }
}

function PaperNode({
  node, isHovered, isSelected, onHover, onClick,
}: {
  node: GraphNode; isHovered: boolean; isSelected: boolean;
  onHover: (id: string | null) => void; onClick: (id: string) => void;
}) {
  const scale = isSelected ? 1.5 : isHovered ? 1.3 : 1;
  const label = node.title.length > 45 ? node.title.slice(0, 45) + "..." : node.title;

  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(node.id);
  }, [node.id, onHover]);

  const handleOut = useCallback(() => onHover(null), [onHover]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(node.id);
  }, [node.id, onClick]);

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh scale={scale} onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshStandardMaterial
          color={node.isRead ? "#ffffff" : "#aaaaaa"}
          emissive={isSelected ? "#ffffff" : isHovered ? "#666666" : "#111111"}
          emissiveIntensity={isSelected ? 0.5 : isHovered ? 0.3 : 0.1}
        />
      </mesh>
      <Text
        position={[0, 0.85, 0]}
        fontSize={isHovered || isSelected ? 0.3 : 0.18}
        color={isHovered || isSelected ? "#ffffff" : "#888888"}
        anchorX="center"
        anchorY="bottom"
        maxWidth={6}
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

function Scene({
  papers, connections, onSelectPaper, selectedPaperId,
}: {
  papers: Paper[]; connections: PaperConnection[];
  onSelectPaper: (id: string) => void; selectedPaperId: string | null;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const graphData = useMemo(() => buildGraph(papers, connections), [papers, connections]);
  const nodesRef = useRef(graphData.nodes);
  const edgesRef = useRef(graphData.edges);
  nodesRef.current = graphData.nodes;
  edgesRef.current = graphData.edges;
  const [tick, setTick] = useState(0);

  useFrame(() => {
    simulateForces(nodesRef.current, edgesRef.current);
    setTick((t) => t + 1);
  });

  // Build edge points for rendering
  const edgeLines = useMemo(() => {
    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));
    return edgesRef.current
      .map((edge) => {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) return null;
        return {
          points: [[a.x, a.y, a.z] as [number, number, number], [b.x, b.y, b.z] as [number, number, number]],
          strength: edge.strength,
        };
      })
      .filter(Boolean) as { points: [number, number, number][]; strength: number }[];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Cluster labels
  const clusterLabels = useMemo(() => {
    const groups = new Map<string, GraphNode[]>();
    for (const n of nodesRef.current) {
      const arr = groups.get(n.clusterName) || [];
      arr.push(n);
      groups.set(n.clusterName, arr);
    }
    return Array.from(groups.entries()).map(([name, groupNodes]) => {
      const cx = groupNodes.reduce((s, n) => s + n.x, 0) / groupNodes.length;
      const maxY = Math.max(...groupNodes.map((n) => n.y));
      const cz = groupNodes.reduce((s, n) => s + n.z, 0) / groupNodes.length;
      return { name, x: cx, y: maxY + 2.5, z: cz };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[20, 20, 20]} intensity={0.5} />

      {/* Edge lines */}
      {edgeLines.map((edge, i) => (
        <Line
          key={i}
          points={edge.points}
          color="#333333"
          lineWidth={1}
          opacity={edge.strength * 0.6}
          transparent
        />
      ))}

      {/* Nodes */}
      {nodesRef.current.map((node) => (
        <PaperNode
          key={node.id}
          node={node}
          isHovered={hoveredId === node.id}
          isSelected={selectedPaperId === node.id}
          onHover={setHoveredId}
          onClick={onSelectPaper}
        />
      ))}

      {/* Cluster labels */}
      {clusterLabels.map((cl) => (
        <Text
          key={cl.name}
          position={[cl.x, cl.y, cl.z]}
          fontSize={0.5}
          color="#333333"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
          letterSpacing={0.1}
        >
          {cl.name.toUpperCase()}
        </Text>
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={60} />
    </>
  );
}

export default function PaperGraph({
  papers, connections, onSelectPaper, selectedPaperId,
}: {
  papers: Paper[]; connections: PaperConnection[];
  onSelectPaper: (id: string) => void; selectedPaperId: string | null;
}) {
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
    <div className="w-full h-full" style={{ background: "#000" }}>
      <Canvas
        camera={{ position: [0, 10, 28], fov: 55 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => gl.setClearColor("#000000")}
      >
        <Scene
          papers={papers}
          connections={connections}
          onSelectPaper={onSelectPaper}
          selectedPaperId={selectedPaperId}
        />
      </Canvas>
    </div>
  );
}
