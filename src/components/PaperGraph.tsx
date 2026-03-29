"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
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
};

type GraphEdge = {
  source: string;
  target: string;
  strength: number;
};

function hashCategory(cat: string): number {
  let hash = 0;
  for (let i = 0; i < cat.length; i++) {
    hash = (hash << 5) - hash + cat.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildGraph(papers: Paper[], connections: PaperConnection[]) {
  const categoryMap = new Map<string, number>();
  let clusterIdx = 0;

  const nodes: GraphNode[] = papers.map((p) => {
    const primaryCat = (p.categories as string[])?.[0] || "unknown";
    if (!categoryMap.has(primaryCat)) {
      categoryMap.set(primaryCat, clusterIdx++);
    }
    const cluster = categoryMap.get(primaryCat)!;

    // Initial position based on cluster with some randomness
    const angle = (cluster / Math.max(categoryMap.size, 1)) * Math.PI * 2;
    const radius = 8 + Math.random() * 4;
    return {
      id: p.id,
      title: p.title,
      categories: p.categories as string[],
      isRead: p.is_read,
      x: Math.cos(angle) * radius + (Math.random() - 0.5) * 5,
      y: (Math.random() - 0.5) * 10,
      z: Math.sin(angle) * radius + (Math.random() - 0.5) * 5,
      vx: 0,
      vy: 0,
      vz: 0,
      cluster,
    };
  });

  const edges: GraphEdge[] = connections.map((c) => ({
    source: c.paper_a,
    target: c.paper_b,
    strength: c.strength,
  }));

  return { nodes, edges, clusterCount: categoryMap.size, categoryMap };
}

// Simple 3D force simulation
function simulateForces(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const dt = 0.015;
  const damping = 0.92;

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
      const force = 2.0 / (dist * dist);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      a.vx += fx;
      a.vy += fy;
      a.vz += fz;
      b.vx -= fx;
      b.vy -= fy;
      b.vz -= fz;
    }
  }

  // Attraction along edges
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;
    const force = (dist - 3) * 0.05 * edge.strength;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    const fz = (dz / dist) * force;
    a.vx += fx;
    a.vy += fy;
    a.vz += fz;
    b.vx -= fx;
    b.vy -= fy;
    b.vz -= fz;
  }

  // Cluster attraction
  const clusterCenters = new Map<number, { x: number; y: number; z: number; count: number }>();
  for (const n of nodes) {
    const c = clusterCenters.get(n.cluster) || { x: 0, y: 0, z: 0, count: 0 };
    c.x += n.x;
    c.y += n.y;
    c.z += n.z;
    c.count++;
    clusterCenters.set(n.cluster, c);
  }
  for (const n of nodes) {
    const c = clusterCenters.get(n.cluster)!;
    const cx = c.x / c.count;
    const cy = c.y / c.count;
    const cz = c.z / c.count;
    n.vx += (cx - n.x) * 0.003;
    n.vy += (cy - n.y) * 0.003;
    n.vz += (cz - n.z) * 0.003;
  }

  // Apply velocities
  for (const n of nodes) {
    n.vx *= damping;
    n.vy *= damping;
    n.vz *= damping;
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.z += n.vz * dt;
  }
}

function PaperNode({
  node,
  isHovered,
  isSelected,
  onHover,
  onClick,
}: {
  node: GraphNode;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scale = isHovered ? 1.4 : isSelected ? 1.2 : 1;

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(node.id);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
        scale={scale}
      >
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={node.isRead ? "#ffffff" : "#888888"}
          emissive={isSelected ? "#ffffff" : isHovered ? "#aaaaaa" : "#000000"}
          emissiveIntensity={isSelected ? 0.5 : isHovered ? 0.3 : 0}
          wireframe={!node.isRead}
          flatShading
        />
      </mesh>
      {(isHovered || isSelected) && (
        <Text
          position={[0, 0.7, 0]}
          fontSize={0.3}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          maxWidth={5}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {node.title.length > 60 ? node.title.slice(0, 60) + "..." : node.title}
        </Text>
      )}
    </group>
  );
}

function GraphEdgeLine({
  from,
  to,
  strength,
}: {
  from: [number, number, number];
  to: [number, number, number];
  strength: number;
}) {
  return (
    <Line
      points={[from, to]}
      color="#333333"
      lineWidth={strength * 2}
      transparent
      opacity={strength * 0.6}
    />
  );
}

function Scene({
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => buildGraph(papers, connections), [papers, connections]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const [, setTick] = useState(0);

  useFrame(() => {
    simulateForces(nodesRef.current, edges);
    setTick((t) => t + 1);
  });

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodesRef.current) m.set(n.id, n);
    return m;
  }, [nodesRef.current]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      {edges.map((edge, i) => {
        const from = nodeMap.get(edge.source);
        const to = nodeMap.get(edge.target);
        if (!from || !to) return null;
        return (
          <GraphEdgeLine
            key={i}
            from={[from.x, from.y, from.z]}
            to={[to.x, to.y, to.z]}
            strength={edge.strength}
          />
        );
      })}

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

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={50}
        makeDefault
      />

      {/* Grid floor */}
      <gridHelper args={[50, 50, "#1a1a1a", "#111111"]} position={[0, -8, 0]} />
    </>
  );
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
  if (papers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-600">
        <div className="text-center">
          <div className="text-6xl mb-4 font-mono">&lt;/&gt;</div>
          <p className="text-sm tracking-widest uppercase">No papers yet</p>
          <p className="text-xs text-neutral-700 mt-2">Add a paper to begin mapping</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 5, 20], fov: 60 }}
      style={{ background: "#000000" }}
      gl={{ antialias: true }}
    >
      <Scene
        papers={papers}
        connections={connections}
        onSelectPaper={onSelectPaper}
        selectedPaperId={selectedPaperId}
      />
    </Canvas>
  );
}
