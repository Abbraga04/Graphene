"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Star, TrendingUp, Clock, ArrowLeft, ExternalLink } from "lucide-react";
import { humanCategory } from "@/lib/categories";
import { decodeEntities } from "@/lib/entities";
import Link from "next/link";

type FeedPaper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  categories: string[];
  published: string | null;
  added_at: string;
  bs_score: any;
  source_url: string | null;
  star_count: number;
  starred: boolean;
  owner: { username: string; display_name: string | null } | null;
};

export default function ExplorePage() {
  const { user, getToken } = useAuth();
  const [papers, setPapers] = useState<FeedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"trending" | "recent" | "stars">("trending");

  useEffect(() => {
    const fetchFeed = async () => {
      setLoading(true);
      try {
        const token = user ? await getToken() : null;
        const res = await fetch(`/api/feed?sort=${sort}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setPapers(data.papers || []);
      } catch (e) {
        console.error("Failed to fetch feed:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchFeed();
  }, [sort, user]);

  const handleToggleStar = async (paperId: string) => {
    if (!user) return;
    const paper = papers.find((p) => p.id === paperId);
    if (!paper) return;

    const token = await getToken();
    const res = await fetch(`/api/papers/${encodeURIComponent(paperId)}/star`, {
      method: paper.starred ? "DELETE" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json();
    setPapers((prev) =>
      prev.map((p) =>
        p.id === paperId ? { ...p, starred: data.starred, star_count: data.star_count } : p
      )
    );
  };

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft size={14} className="text-text-dim" />
            <img src="/graphene.png" alt="Graphene" className="w-6 h-6 invert" />
            <span className="text-sm tracking-[0.2em] uppercase text-accent" style={{ fontWeight: 800 }}>
              Explore
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {(["trending", "recent", "stars"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider uppercase border transition-colors ${
                sort === s
                  ? "border-accent text-accent"
                  : "border-border text-text-dim hover:text-text hover:border-border-hover"
              }`}
            >
              {s === "trending" && <TrendingUp size={10} />}
              {s === "recent" && <Clock size={10} />}
              {s === "stars" && <Star size={10} />}
              {s}
            </button>
          ))}
        </div>
      </header>

      {/* Feed */}
      <div className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="text-center py-12 text-text-dim text-xs tracking-wider">
            Loading...
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-dim text-xs tracking-wider">No public papers yet</p>
            <p className="text-text-dim text-[10px] mt-2">
              Be the first to share — mark a paper as Public in your library
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="border border-border p-4 hover:border-border-hover transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Star button */}
                  <button
                    onClick={() => handleToggleStar(paper.id)}
                    className={`mt-0.5 shrink-0 flex flex-col items-center gap-0.5 transition-colors ${
                      paper.starred ? "text-yellow-400" : "text-text-dim hover:text-text"
                    }`}
                  >
                    <Star size={16} fill={paper.starred ? "currentColor" : "none"} />
                    <span className="text-[9px]">{paper.star_count}</span>
                  </button>

                  {/* Paper info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-accent leading-tight">
                      {decodeEntities(paper.title)}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-1">
                      {(paper.authors as string[])?.slice(0, 3).join(", ")}
                      {(paper.authors as string[])?.length > 3 && " et al."}
                    </p>

                    {/* Scores inline */}
                    {paper.bs_score && (
                      <div className="flex items-center gap-3 mt-2">
                        {paper.bs_score.interesting != null && (
                          <span className="text-[9px] tracking-wider">
                            <span className="text-text-dim">INTERESTING </span>
                            <span style={{
                              color: paper.bs_score.interesting >= 80 ? "#8bf7c4"
                                : paper.bs_score.interesting >= 60 ? "#b8f78b"
                                : "#f7e88b"
                            }}>
                              {paper.bs_score.interesting}
                            </span>
                          </span>
                        )}
                        {paper.bs_score.overall != null && (
                          <span className="text-[9px] tracking-wider">
                            <span className="text-text-dim">LEGIT </span>
                            <span style={{
                              color: (100 - paper.bs_score.overall) >= 80 ? "#8bf7c4"
                                : (100 - paper.bs_score.overall) >= 60 ? "#b8f78b"
                                : "#f7e88b"
                            }}>
                              {100 - paper.bs_score.overall}
                            </span>
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      {(paper.categories as string[])?.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-[9px] text-text-dim border border-border px-1.5 py-0.5"
                        >
                          {humanCategory(cat)}
                        </span>
                      ))}
                      {paper.owner && (
                        <Link
                          href={`/profile/${paper.owner.username}`}
                          className="text-[9px] text-text-dim hover:text-accent transition-colors"
                        >
                          @{paper.owner.username}
                        </Link>
                      )}
                      {paper.source_url && (
                        <a
                          href={paper.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-dim hover:text-text transition-colors"
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
