"use client";

import { useMemo, useState } from "react";
import { Paper, PaperConnection } from "@/lib/supabase";

type GroupedPapers = {
  category: string;
  papers: Paper[];
};

function groupByCategory(papers: Paper[]): GroupedPapers[] {
  const map = new Map<string, Paper[]>();
  for (const p of papers) {
    const cats = (p.categories as string[]) || [];
    const primary = cats[0] || "Uncategorized";
    const arr = map.get(primary) || [];
    arr.push(p);
    map.set(primary, arr);
  }
  return Array.from(map.entries())
    .map(([category, papers]) => ({ category, papers }))
    .sort((a, b) => b.papers.length - a.papers.length);
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const groups = useMemo(() => groupByCategory(papers), [papers]);

  // Build connection map for showing links
  const connectionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of connections) {
      if (!map.has(c.paper_a)) map.set(c.paper_a, new Set());
      if (!map.has(c.paper_b)) map.set(c.paper_b, new Set());
      map.get(c.paper_a)!.add(c.paper_b);
      map.get(c.paper_b)!.add(c.paper_a);
    }
    return map;
  }, [connections]);

  const connectedToHovered = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    return connectionMap.get(hoveredId) || new Set<string>();
  }, [hoveredId, connectionMap]);

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
    <div className="w-full h-full overflow-auto bg-bg p-8">
      <div className="flex flex-wrap gap-6">
        {groups.map((group) => (
          <div
            key={group.category}
            className="border border-border rounded-sm bg-surface/50 p-5 min-w-[250px] max-w-[400px] flex-1"
          >
            {/* Category header */}
            <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-text-dim mb-4 pb-2 border-b border-border">
              {group.category}
              <span className="ml-2 text-text-dim font-normal">({group.papers.length})</span>
            </h3>

            {/* Paper nodes */}
            <div className="space-y-1">
              {group.papers.map((paper) => {
                const isSelected = paper.id === selectedPaperId;
                const isHovered = paper.id === hoveredId;
                const isConnected = connectedToHovered.has(paper.id);
                const bs = (paper as any).bs_score;
                const legit = bs ? 100 - bs.overall : null;
                const interesting = bs?.interesting ?? null;

                return (
                  <button
                    key={paper.id}
                    onClick={() => onSelectPaper(paper.id)}
                    onMouseEnter={() => setHoveredId(paper.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`w-full text-left px-3 py-2.5 rounded-sm transition-all duration-150 group ${
                      isSelected
                        ? "bg-white/10 border border-white/30"
                        : isHovered
                        ? "bg-white/5 border border-white/10"
                        : isConnected
                        ? "bg-white/[0.03] border border-white/10"
                        : "border border-transparent hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Node dot */}
                      <div
                        className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 transition-all ${
                          isSelected
                            ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                            : paper.is_read
                            ? "bg-white/60"
                            : "bg-white/30"
                        }`}
                      />

                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs leading-tight transition-colors ${
                            isSelected ? "text-white font-medium" : "text-text group-hover:text-white"
                          }`}
                        >
                          {paper.title}
                        </p>
                        <p className="text-[9px] text-text-dim mt-1 truncate">
                          {(paper.authors as string[])?.slice(0, 3).join(", ")}
                          {(paper.authors as string[])?.length > 3 && " et al."}
                        </p>
                      </div>

                      {/* Scores */}
                      {legit != null && (
                        <div className="shrink-0 flex gap-2 items-center">
                          <div className="text-center">
                            <p className="text-[8px] text-text-dim">INT</p>
                            <p
                              className="text-[10px] font-bold"
                              style={{
                                color:
                                  interesting >= 70 ? "#8bf7c4" : interesting >= 40 ? "#f7e88b" : "#666",
                              }}
                            >
                              {interesting}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] text-text-dim">LEG</p>
                            <p
                              className="text-[10px] font-bold"
                              style={{
                                color:
                                  legit >= 70 ? "#8bf7c4" : legit >= 40 ? "#f7e88b" : "#f78b8b",
                              }}
                            >
                              {legit}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Connected papers indicator */}
                    {isHovered && connectionMap.has(paper.id) && (
                      <p className="text-[8px] text-text-dim mt-1 ml-5">
                        Connected to {connectionMap.get(paper.id)!.size} papers
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
