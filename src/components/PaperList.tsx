"use client";

import { Paper } from "@/lib/supabase";
import { humanCategory } from "@/lib/categories";
import { BookOpen, Check, Clock, ChevronRight } from "lucide-react";

export default function PaperList({
  papers,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
}: {
  papers: Paper[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: "all" | "read" | "unread";
  onFilterChange: (f: "all" | "read" | "unread") => void;
}) {
  const filtered = papers.filter((p) => {
    if (filter === "read") return p.is_read;
    if (filter === "unread") return !p.is_read;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Filter tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`flex-1 px-3 py-2.5 text-[10px] tracking-[0.2em] uppercase transition-colors ${
              filter === f
                ? "text-accent border-b border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {f} ({papers.filter((p) => f === "all" ? true : f === "read" ? p.is_read : !p.is_read).length})
          </button>
        ))}
      </div>

      {/* Paper list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-text-dim text-xs tracking-wider">
            No papers
          </div>
        ) : (
          filtered.map((paper) => (
            <button
              key={paper.id}
              onClick={() => onSelect(paper.id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors group ${
                selectedId === paper.id
                  ? "bg-surface-2 border-l-2 border-l-accent"
                  : "hover:bg-surface-2/50"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">
                  {paper.is_read ? (
                    <Check size={12} className="text-accent" />
                  ) : (
                    <Clock size={12} className="text-text-dim" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xs font-medium text-text leading-tight line-clamp-2">
                    {paper.title}
                  </h3>
                  <p className="text-[10px] text-text-muted mt-1 truncate">
                    {(paper.authors as string[])?.slice(0, 2).join(", ")}
                    {(paper.authors as string[])?.length > 2 && " et al."}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(paper.categories as string[])?.slice(0, 2).map((cat) => (
                      <span
                        key={cat}
                        className="text-[9px] text-text-dim border border-border px-1.5 py-0.5"
                      >
                        {humanCategory(cat)}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight
                  size={12}
                  className="text-text-dim group-hover:text-text-muted transition-colors mt-1 shrink-0"
                />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
