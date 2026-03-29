"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
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
    const total = Math.max(categoryMap.size, 1);
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
      const fx = (dx / dist) * force, fy = (dy / dist) * force, fz = (dz / dist) * force;
      a.vx += fx; a.vy += fy; a.vz += fz;
      b.vx -= fx; b.vy -= fy; b.vz -= fz;
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

function NodeMesh({ node, isHovered, isSelected, onHover, onClick }: {
  node: GraphNode; isHovered: boolean; isSelected: boolean;
  onHover: (id: string | null) => void; onClick: (id: string) => void;
}) {
  const scale = isSelected ? 1.5 : isHovered ? 1.3 : 1;
  const label = node.title.length > 45 ? node.title.slice(0, 45) + "..." : node.title;

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        scale={scale}
        onPointerOver={(e) => { e.stopPropagation(); onHover(node.id); }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      >
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial
          color={node.isRead ? "#ffffff" : "#aaaaaa"}
          emissive={isSelected ? "#ffffff" : isHovered ? "#888888" : "#222222"}
          emissiveIntensity={isSelected ? 0.6 : isHovered ? 0.4 : 0.15}
        />
      </mesh>
      <Text
        position={[0, 0.85, 0]}
        fontSize={isHovered || isSelected ? 0.32 : 0.2}
        color={isHovered || isSelected ? "#ffffff" : "#999999"}
        anchorX="center"
        anchorY="bottom"
        maxWidth={6}
        outlineWidth={0.025}
        outlineColor="#000000"
      >
        {label}
      </Text>
    </group>
  );
}

function ClusterCloud({ name, nodes }: { name: string; nodes: GraphNode[] }) {
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  const cz = nodes.reduce((s, n) => s + n.z, 0) / nodes.length;
  const maxY = Math.max(...nodes.map((n) => n.y));

  return (
    <Text
      position={[cx, maxY + 2.5, cz]}
      fontSize={0.55}
      color="#333333"
      anchorX="center"
      anchorY="bottom"
      outlineWidth={0.02}
      outlineColor="#000000"
      letterSpacing={0.12}
    >
      {name.toUpperCase()}
    </Text>
  );
}

function EdgeLine({ from, to, strength }: {
  from: [number, number, number]; to: [number, number, number]; strength: number;
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
    return g;
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);

  return (
    <line geometry={geo}>
      <lineBasicMaterial color="#444444" transparent opacity={strength * 0.7} />
    </line>
  );
}

function Scene({ papers, connections, onSelectPaper, selectedPaperId }: {
  papers: Paper[]; connections: PaperConnection[];
  onSelectPaper: (id: string) => void; selectedPaperId: string | null;
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

  const nodeMap = useMemo(() => new Map(nodesRef.current.map((n) => [n.id, n])), [nodesRef.current]);

  const clusterGroups = useMemo(() => {
    const groups = new Map<string, GraphNode[]>();
    for (const n of nodesRef.current) {
      const arr = groups.get(n.clusterName) || [];
      arr.push(n);
      groups.set(n.clusterName, arr);
    }
    return groups;
  }, [nodesRef.current]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[20, 20, 20]} intensity={0.6} />
      <pointLight position={[-20, -10, -20]} intensity={0.2} />

      {edges.map((edge, i) => {
        const a = nodeMap.get(edge.source), b = nodeMap.get(edge.target);
        if (!a || !b) return null;
        return <EdgeLine key={i} from={[a.x, a.y, a.z]} to={[b.x, b.y, b.z]} strength={edge.strength} />;
      })}

      {nodesRef.current.map((node) => (
        <NodeMesh
          key={node.id} node={node}
          isHovered={hoveredId === node.id}
          isSelected={selectedPaperId === node.id}
          onHover={setHoveredId} onClick={onSelectPaper}
        />
      ))}

      {Array.from(clusterGroups.entries()).map(([name, groupNodes]) => (
        <ClusterCloud key={name} name={name} nodes={groupNodes} />
      ))}

      <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={60} />
    </>
  );
}

export default function PaperGraph({ papers, connections, onSelectPaper, selectedPaperId }: {
  papers: Paper[]; connections: PaperConnection[];
  onSelectPaper: (id: string) => void; selectedPaperId: string | null;
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
    <Canvas camera={{ position: [0, 10, 28], fov: 55 }} style={{ background: "#000000" }} gl={{ antialias: true }}>
      <Scene papers={papers} connections={connections} onSelectPaper={onSelectPaper} selectedPaperId={selectedPaperId} />
    </Canvas>
  );
}
