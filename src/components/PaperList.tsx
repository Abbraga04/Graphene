"use client";

import { useState, useMemo } from "react";
import { Paper } from "@/lib/supabase";
import { humanCategory } from "@/lib/categories";
import { Check, Clock, ChevronRight, ChevronDown, ArrowUpDown } from "lucide-react";

type SortOption = "newest" | "oldest" | "title" | "recently_read";
type ReadFilter = "all" | "read" | "unread";

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
  filter: ReadFilter;
  onFilterChange: (f: ReadFilter) => void;
}) {
  const [sort, setSort] = useState<SortOption>("newest");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Get all unique categories across papers
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const p of papers) {
      for (const c of (p.categories as string[]) || []) {
        cats.add(c);
      }
    }
    return Array.from(cats).sort();
  }, [papers]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = papers.filter((p) => {
      if (filter === "read") return p.is_read;
      if (filter === "unread") return !p.is_read;
      return true;
    });

    if (selectedCategory) {
      result = result.filter((p) =>
        (p.categories as string[])?.includes(selectedCategory)
      );
    }

    result.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        case "oldest":
          return new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "recently_read":
          if (a.read_at && b.read_at) return new Date(b.read_at).getTime() - new Date(a.read_at).getTime();
          if (a.read_at) return -1;
          if (b.read_at) return 1;
          return new Date(b.added_at).getTime() - new Date(a.added_at).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [papers, filter, selectedCategory, sort]);

  return (
    <div className="h-full flex flex-col">
      {/* Read filter tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`flex-1 px-2 py-2.5 text-[9px] tracking-[0.15em] uppercase whitespace-nowrap transition-colors ${
              filter === f
                ? "text-accent border-b border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {f} ({papers.filter((p) => f === "all" ? true : f === "read" ? p.is_read : !p.is_read).length})
          </button>
        ))}
      </div>

      {/* Sort & category filters */}
      <div className="border-b border-border shrink-0">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-text-dim tracking-wider uppercase hover:text-text transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ArrowUpDown size={10} />
            {sort === "newest" ? "Newest first" : sort === "oldest" ? "Oldest first" : sort === "title" ? "A-Z" : "Recently read"}
            {selectedCategory && ` / ${humanCategory(selectedCategory)}`}
          </span>
          <ChevronDown size={10} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>

        {showFilters && (
          <div className="px-4 pb-3 space-y-3 animate-fade-in">
            {/* Sort options */}
            <div>
              <p className="text-[9px] text-text-dim tracking-[0.2em] uppercase mb-1.5">Sort by</p>
              <div className="flex flex-wrap gap-1">
                {([
                  ["newest", "Newest"],
                  ["oldest", "Oldest"],
                  ["title", "A-Z"],
                  ["recently_read", "Last read"],
                ] as [SortOption, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={`px-2 py-1 text-[9px] tracking-wider border transition-colors ${
                      sort === value
                        ? "border-accent text-accent"
                        : "border-border text-text-dim hover:text-text hover:border-border-hover"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category filter */}
            {allCategories.length > 0 && (
              <div>
                <p className="text-[9px] text-text-dim tracking-[0.2em] uppercase mb-1.5">Category</p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-2 py-1 text-[9px] tracking-wider border transition-colors ${
                      !selectedCategory
                        ? "border-accent text-accent"
                        : "border-border text-text-dim hover:text-text hover:border-border-hover"
                    }`}
                  >
                    All
                  </button>
                  {allCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                      className={`px-2 py-1 text-[9px] tracking-wider border transition-colors ${
                        selectedCategory === cat
                          ? "border-accent text-accent"
                          : "border-border text-text-dim hover:text-text hover:border-border-hover"
                      }`}
                    >
                      {humanCategory(cat)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
                    <span className="text-[9px] text-text-dim">
                      {new Date(paper.added_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
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
