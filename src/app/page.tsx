"use client";

import { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { Paper, PaperConnection, ChatMessage } from "@/lib/supabase";
import PaperList from "@/components/PaperList";
import PaperDetail from "@/components/PaperDetail";
import AddPaperModal from "@/components/AddPaperModal";
import {
  Plus,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Hexagon,
} from "lucide-react";

const PaperGraph = lazy(() => import("@/components/PaperGraph"));

export default function Home() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [connections, setConnections] = useState<PaperConnection[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [searchLocal, setSearchLocal] = useState("");

  // Fetch all papers
  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch("/api/papers");
      const data = await res.json();
      setPapers(data.papers || []);
      setConnections(data.connections || []);
    } catch (e) {
      console.error("Failed to fetch papers:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Fetch single paper detail
  const selectPaper = useCallback(async (id: string) => {
    setSelectedPaperId(id);
    try {
      const res = await fetch(`/api/papers/${encodeURIComponent(id)}`);
      const data = await res.json();
      setSelectedPaper(data.paper);
      setChatMessages(data.messages || []);
    } catch (e) {
      console.error("Failed to fetch paper:", e);
    }
  }, []);

  // Add paper
  const handleAddPaper = async (url: string) => {
    setAdding(true);
    try {
      const res = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchPapers();
    } finally {
      setAdding(false);
    }
  };

  // Toggle read status
  const handleToggleRead = async () => {
    if (!selectedPaper) return;
    try {
      const res = await fetch(`/api/papers/${encodeURIComponent(selectedPaper.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: !selectedPaper.is_read }),
      });
      const data = await res.json();
      setSelectedPaper(data.paper);
      fetchPapers();
    } catch (e) {
      console.error(e);
    }
  };

  // Update notes
  const handleUpdateNotes = async (notes: string) => {
    if (!selectedPaper) return;
    try {
      await fetch(`/api/papers/${encodeURIComponent(selectedPaper.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Filter papers by local search
  const filteredPapers = papers.filter((p) => {
    if (!searchLocal) return true;
    const q = searchLocal.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.authors as string[])?.some((a) => a.toLowerCase().includes(q)) ||
      (p.categories as string[])?.some((c) => c.toLowerCase().includes(q))
    );
  });

  const stats = {
    total: papers.length,
    read: papers.filter((p) => p.is_read).length,
    connections: connections.length,
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-surface">
        <div className="flex items-center gap-3">
          <Hexagon size={16} className="text-accent" strokeWidth={2} />
          <span className="text-xs font-semibold tracking-[0.3em] uppercase text-accent">
            Graphene
          </span>
          <span className="text-[9px] text-text-dim tracking-wider ml-2 hidden sm:inline">
            {stats.total} papers / {stats.read} read / {stats.connections} links
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Local search */}
          <div className="relative hidden sm:block">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="text"
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              placeholder="Filter..."
              className="bg-bg border border-border pl-7 pr-3 py-1.5 text-[10px] text-text w-40 focus:outline-none focus:border-border-hover focus:w-56 transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="flex border border-border">
            <button
              onClick={() => setView("graph")}
              className={`p-1.5 transition-colors ${
                view === "graph"
                  ? "bg-accent text-bg"
                  : "text-text-muted hover:text-text"
              }`}
              title="3D Graph"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 transition-colors ${
                view === "list"
                  ? "bg-accent text-bg"
                  : "text-text-muted hover:text-text"
              }`}
              title="List"
            >
              <List size={14} />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-bg text-[10px] font-medium tracking-wider uppercase hover:bg-text transition-colors"
          >
            {adding ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            Add
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - paper list */}
        {view === "list" && (
          <div className="w-80 border-r border-border shrink-0 overflow-hidden">
            <PaperList
              papers={filteredPapers}
              selectedId={selectedPaperId}
              onSelect={selectPaper}
              filter={filter}
              onFilterChange={setFilter}
            />
          </div>
        )}

        {/* Main view */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-text-dim" />
            </div>
          ) : view === "graph" ? (
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-text-dim" />
                </div>
              }
            >
              <PaperGraph
                papers={filteredPapers}
                connections={connections}
                onSelectPaper={selectPaper}
                selectedPaperId={selectedPaperId}
              />
            </Suspense>
          ) : null}

          {/* Graph overlay: paper count chips */}
          {view === "graph" && papers.length > 0 && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              <div className="bg-surface/80 backdrop-blur border border-border px-3 py-1.5 text-[9px] tracking-wider text-text-muted">
                {papers.length} nodes / {connections.length} edges
              </div>
              <div className="bg-surface/80 backdrop-blur border border-border px-3 py-1.5 text-[9px] tracking-wider text-text-muted">
                Scroll to zoom / Drag to rotate
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedPaper && (
          <div className="w-96 border-l border-border shrink-0 overflow-hidden">
            <PaperDetail
              paper={selectedPaper}
              messages={chatMessages}
              onClose={() => {
                setSelectedPaperId(null);
                setSelectedPaper(null);
              }}
              onToggleRead={handleToggleRead}
              onUpdateNotes={handleUpdateNotes}
            />
          </div>
        )}
      </div>

      {/* Add modal */}
      <AddPaperModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddPaper}
      />
    </div>
  );
}
