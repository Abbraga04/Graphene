"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { Paper, PaperConnection } from "@/lib/supabase";

const COLORS = [
  { fill: "rgba(99,130,255,0.08)", stroke: "rgba(99,130,255,0.25)", dot: "#6382ff" },
  { fill: "rgba(255,130,99,0.08)", stroke: "rgba(255,130,99,0.25)", dot: "#ff8263" },
  { fill: "rgba(99,255,170,0.08)", stroke: "rgba(99,255,170,0.25)", dot: "#63ffaa" },
  { fill: "rgba(255,220,99,0.08)", stroke: "rgba(255,220,99,0.25)", dot: "#ffdc63" },
  { fill: "rgba(190,99,255,0.08)", stroke: "rgba(190,99,255,0.25)", dot: "#be63ff" },
  { fill: "rgba(99,210,255,0.08)", stroke: "rgba(99,210,255,0.25)", dot: "#63d2ff" },
];

type Node = {
  id: string;
  title: string;
  category: string;
  colorIdx: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

type Edge = { a: string; b: string };

function buildNodes(papers: Paper[], connections: PaperConnection[], W: number, H: number) {
  const catMap = new Map<string, number>();
  let ci = 0;

  const nodes: Node[] = papers.map((p) => {
    const cats = (p.categories as string[]) || [];
    const cat = cats[0] || "Other";
    if (!catMap.has(cat)) catMap.set(cat, ci++);
    const colorIdx = catMap.get(cat)! % COLORS.length;

    // Place in a circle by category
    const angle = (catMap.get(cat)! / Math.max(ci, 1)) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 120 + Math.random() * 80;

    return {
      id: p.id,
      title: p.title,
      category: cat,
      colorIdx,
      x: W / 2 + Math.cos(angle) * dist,
      y: H / 2 + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      radius: 6,
    };
  });

  const nodeIds = new Set(papers.map((p) => p.id));
  const edges: Edge[] = connections
    .filter((c) => nodeIds.has(c.paper_a) && nodeIds.has(c.paper_b))
    .map((c) => ({ a: c.paper_a, b: c.paper_b }));

  return { nodes, edges };
}

function simulate(nodes: Node[], edges: Edge[], W: number, H: number) {
  const map = new Map(nodes.map((n) => [n.id, n]));

  // Repulsion
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const force = 800 / (dist * dist);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
  }

  // Edge attraction
  for (const e of edges) {
    const a = map.get(e.a), b = map.get(e.b);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 1;
    const force = (dist - 80) * 0.003;
    a.vx += (dx / dist) * force; a.vy += (dy / dist) * force;
    b.vx -= (dx / dist) * force; b.vy -= (dy / dist) * force;
  }

  // Center gravity
  for (const n of nodes) {
    n.vx += (W / 2 - n.x) * 0.001;
    n.vy += (H / 2 - n.y) * 0.001;
  }

  // Apply + damping
  for (const n of nodes) {
    n.vx *= 0.85; n.vy *= 0.85;
    n.x += n.vx; n.y += n.vy;
    // Keep in bounds
    n.x = Math.max(40, Math.min(W - 40, n.x));
    n.y = Math.max(40, Math.min(H - 40, n.y));
  }
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef(selectedPaperId);
  selectedRef.current = selectedPaperId;
  const [dims, setDims] = useState({ w: 800, h: 600 });
  const panRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const settledRef = useRef(false);

  // Resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build graph data
  useEffect(() => {
    const { nodes, edges } = buildNodes(papers, connections, dims.w, dims.h);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    settledRef.current = false;
  }, [papers, connections, dims.w, dims.h]);

  // Screen <-> world transforms
  const toWorld = useCallback((sx: number, sy: number) => {
    const p = panRef.current;
    return { x: (sx - p.x) / p.scale, y: (sy - p.y) / p.scale };
  }, []);

  const findNode = useCallback((sx: number, sy: number): Node | null => {
    const { x, y } = toWorld(sx, sy);
    for (const n of nodesRef.current) {
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < 400) return n; // 20px radius
    }
    return null;
  }, [toWorld]);

  // Mouse handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;

      if (dragRef.current) {
        panRef.current.x = dragRef.current.panX + (e.clientX - dragRef.current.startX);
        panRef.current.y = dragRef.current.panY + (e.clientY - dragRef.current.startY);
        return;
      }

      const node = findNode(sx, sy);
      hoveredRef.current = node?.id || null;
      canvas.style.cursor = node ? "pointer" : "grab";
    };

    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      const node = findNode(sx, sy);

      if (node) {
        onSelectPaper(node.id);
      } else {
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        canvas.style.cursor = "grabbing";
      }
    };

    const onMouseUp = () => {
      dragRef.current = null;
      canvas.style.cursor = "grab";
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const p = panRef.current;
      const zoom = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.3, Math.min(3, p.scale * zoom));
      p.x = mx - (mx - p.x) * (newScale / p.scale);
      p.y = my - (my - p.y) * (newScale / p.scale);
      p.scale = newScale;
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [findNode, onSelectPaper]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let simSteps = 0;

    const render = () => {
      const W = dims.w, H = dims.h;
      canvas.width = W * 2; // retina
      canvas.height = H * 2;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.scale(2, 2);

      // Physics
      if (!settledRef.current && simSteps < 200) {
        simulate(nodesRef.current, edgesRef.current, W, H);
        simSteps++;
        if (simSteps >= 200) settledRef.current = true;
      }

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const map = new Map(nodes.map((n) => [n.id, n]));
      const p = panRef.current;

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.scale, p.scale);

      // Cluster backgrounds
      const clusters = new Map<string, Node[]>();
      for (const n of nodes) {
        const arr = clusters.get(n.category) || [];
        arr.push(n);
        clusters.set(n.category, arr);
      }

      clusters.forEach((cnodes, cat) => {
        if (cnodes.length === 0) return;
        const ci = cnodes[0].colorIdx;
        const color = COLORS[ci];
        const cx = cnodes.reduce((s, n) => s + n.x, 0) / cnodes.length;
        const cy = cnodes.reduce((s, n) => s + n.y, 0) / cnodes.length;
        let maxD = 0;
        for (const n of cnodes) {
          const d = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
          if (d > maxD) maxD = d;
        }
        const r = Math.min(Math.max(maxD + 50, 60), 200);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color.fill;
        ctx.fill();
        ctx.strokeStyle = color.stroke;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Category label
        const fs = 11 / p.scale;
        ctx.font = `700 ${Math.max(fs, 8)}px JetBrains Mono, monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = color.stroke;
        ctx.fillText(cat.toUpperCase(), cx, cy - r + 16);
      });

      // Edges
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (const e of edges) {
        const a = map.get(e.a), b = map.get(e.b);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const isSel = n.id === selectedRef.current;
        const isHov = n.id === hoveredRef.current;
        const r = isSel ? 9 : isHov ? 8 : 6;

        // Glow
        if (isSel || isHov) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fill();
        }

        // Dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSel ? "#fff" : "#aaa";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label — measure with canvas, truncate smartly
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        if (isSel || isHov) {
          // Full label in pill
          const fs = Math.max(11, 11 / p.scale);
          ctx.font = `600 ${fs}px JetBrains Mono, monospace`;
          const maxW = 250;
          let label = n.title;
          while (ctx.measureText(label).width > maxW && label.length > 10) {
            label = label.slice(0, -4) + "...";
          }
          const tw = ctx.measureText(label).width;
          const px = 6, py = 3;

          ctx.fillStyle = "rgba(0,0,0,0.92)";
          ctx.fillRect(n.x - tw / 2 - px, n.y - r - fs - py * 2 - 6, tw + px * 2, fs + py * 2);
          ctx.fillStyle = "#fff";
          ctx.fillText(label, n.x, n.y - r - fs - py - 6);
        } else {
          // Short label
          const fs = Math.max(8, 8 / p.scale);
          ctx.font = `${fs}px JetBrains Mono, monospace`;
          const maxW = 100;
          let label = n.title;
          while (ctx.measureText(label).width > maxW && label.length > 5) {
            label = label.slice(0, -4) + "...";
          }
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillText(label, n.x, n.y + r + 3);
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animRef.current);
  }, [dims]);

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
    <div ref={containerRef} className="w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
