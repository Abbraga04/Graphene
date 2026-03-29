"use client";

import { useState } from "react";
import { X, Plus, Search, Loader2, ExternalLink } from "lucide-react";

type ArxivResult = {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  categories: string[];
  pdfUrl: string;
  sourceUrl: string;
};

export default function AddPaperModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ArxivResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"url" | "search">("url");

  if (!isOpen) return null;

  const handleSubmitUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onAdd(url.trim());
      setUrl("");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add paper");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFromSearch = async (result: ArxivResult) => {
    setAdding(result.id);
    try {
      await onAdd(result.sourceUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface border border-border animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-sm font-medium tracking-widest uppercase text-accent">
            Add Paper
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("url")}
            className={`flex-1 px-4 py-3 text-xs tracking-widest uppercase transition-colors ${
              tab === "url"
                ? "text-accent border-b border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Paste URL
          </button>
          <button
            onClick={() => setTab("search")}
            className={`flex-1 px-4 py-3 text-xs tracking-widest uppercase transition-colors ${
              tab === "search"
                ? "text-accent border-b border-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            Search arXiv
          </button>
        </div>

        <div className="p-6">
          {tab === "url" ? (
            <div>
              <label className="block text-xs text-text-muted mb-2 tracking-wider uppercase">
                arXiv URL or Paper ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitUrl()}
                  placeholder="https://arxiv.org/abs/2301.00001 or 2301.00001"
                  className="flex-1 bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
                />
                <button
                  onClick={handleSubmitUrl}
                  disabled={loading || !url.trim()}
                  className="px-4 py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Add
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-text-muted mb-2 tracking-wider uppercase">
                Search Query
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="transformer attention mechanism..."
                  className="flex-1 bg-bg border border-border px-4 py-3 text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading || !searchQuery.trim()}
                  className="px-4 py-3 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                  Search
                </button>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto space-y-1">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 border border-border hover:border-border-hover transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm text-text font-medium leading-tight truncate">
                          {result.title}
                        </h3>
                        <p className="text-xs text-text-muted mt-1 truncate">
                          {result.authors.slice(0, 3).join(", ")}
                          {result.authors.length > 3 && ` +${result.authors.length - 3}`}
                        </p>
                        <p className="text-xs text-text-dim mt-1 line-clamp-2">
                          {result.abstract.slice(0, 150)}...
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFromSearch(result)}
                        disabled={adding === result.id}
                        className="shrink-0 px-3 py-1.5 border border-border text-xs tracking-wider uppercase hover:bg-accent hover:text-bg hover:border-accent disabled:opacity-30 transition-colors"
                      >
                        {adding === result.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          "Add"
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 mt-3 tracking-wider">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
