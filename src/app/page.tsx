"use client";

import { useState, useEffect, useCallback } from "react";
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
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import PaperReader from "@/components/PaperReader";
import ResizeHandle from "@/components/ResizeHandle";

import PaperGraph from "@/components/PaperGraph";

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
  const [listWidth, setListWidth] = useState(320);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [detailWidth, setDetailWidth] = useState(420);

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
    // Close modal immediately and show loading state
    setShowAddModal(false);
    setView("list");
    setAdding(true);

    try {
      const res = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Add paper failed:", data.error);
        return;
      }

      // Show the paper
      await fetchPapers();
      setSelectedPaperId(data.paper.id);
      setSelectedPaper(data.paper);
      setChatMessages([]);

      // Enrich in the background (summary, connections) with streaming
      if (!data.alreadyExists) {
        enrichPaper(data.paper.id);
      }
    } catch (e) {
      console.error("Failed to add paper:", e);
    } finally {
      setAdding(false);
    }
  };

  const enrichPaper = (paperId: string) => {
    const evtSource = new EventSource(`/api/papers/${encodeURIComponent(paperId)}/enrich`);

    // EventSource only does GET, so use fetch with POST instead
    fetch(`/api/papers/${encodeURIComponent(paperId)}/enrich`, { method: "POST" })
      .then(async (res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedSummary = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(line.slice(6));
                // Check previous line for event type
                const eventLine = lines[lines.indexOf(line) - 1];
                const eventType = eventLine?.startsWith("event: ")
                  ? eventLine.slice(7)
                  : "";

                if (eventType === "summary_chunk") {
                  streamedSummary += eventData.text;
                  setSelectedPaper((prev) =>
                    prev && prev.id === paperId
                      ? { ...prev, summary: streamedSummary }
                      : prev
                  );
                } else if (eventType === "metadata") {
                  setSelectedPaper((prev) =>
                    prev && prev.id === paperId
                      ? { ...prev, ...eventData }
                      : prev
                  );
                  fetchPapers();
                } else if (eventType === "done") {
                  fetchPapers();
                }
              } catch {}
            }
          }
        }
      })
      .catch(console.error);
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
      <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface">
        <div className="flex items-center gap-4">
          <Hexagon size={20} className="text-accent" strokeWidth={2} />
          <span className="text-sm font-semibold tracking-[0.3em] uppercase text-accent">
            Graphene
          </span>
          <span className="text-xs text-text-dim tracking-wider ml-2 hidden sm:inline">
            {adding ? (
              <span className="flex items-center gap-2">
                <Loader2 size={10} className="animate-spin" />
                Adding paper...
              </span>
            ) : (
              <>{stats.total} papers / {stats.read} read / {stats.connections} links</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Local search */}
          <div className="relative hidden sm:block">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              type="text"
              value={searchLocal}
              onChange={(e) => setSearchLocal(e.target.value)}
              placeholder="Filter..."
              className="bg-bg border border-border pl-9 pr-4 py-2 text-xs text-text w-48 focus:outline-none focus:border-border-hover focus:w-64 transition-all"
            />
          </div>

          {/* View toggle */}
          <div className="flex border border-border">
            <button
              onClick={() => setView("graph")}
              className={`p-2.5 transition-colors ${
                view === "graph"
                  ? "bg-accent text-bg"
                  : "text-text-muted hover:text-text"
              }`}
              title="3D Graph"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2.5 transition-colors ${
                view === "list"
                  ? "bg-accent text-bg"
                  : "text-text-muted hover:text-text"
              }`}
              title="List"
            >
              <List size={16} />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-bg text-xs font-medium tracking-wider uppercase hover:bg-text transition-colors"
          >
            {adding ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Add Paper
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - paper list */}
        {view === "list" && (
          <>
            <div
              style={{ width: listCollapsed ? 0 : listWidth }}
              className="shrink-0 overflow-hidden transition-[width] duration-200"
            >
              <div style={{ width: listWidth }} className="h-full">
                <PaperList
                  papers={filteredPapers}
                  selectedId={selectedPaperId}
                  onSelect={selectPaper}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </div>
            </div>
            <div className="shrink-0 flex flex-col">
              <button
                onClick={() => setListCollapsed((c) => !c)}
                className="px-1 py-2 hover:bg-surface-2 transition-colors text-text-dim hover:text-text"
                title={listCollapsed ? "Show sidebar" : "Hide sidebar"}
              >
                {listCollapsed ? (
                  <PanelLeftOpen size={14} />
                ) : (
                  <PanelLeftClose size={14} />
                )}
              </button>
              {!listCollapsed && (
                <div className="flex-1">
                  <ResizeHandle
                    onResize={(delta) =>
                      setListWidth((w) => Math.max(200, Math.min(600, w + delta)))
                    }
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Main view */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-text-dim" />
            </div>
          ) : view === "graph" ? (
            /* Graph always visible in graph mode */
            <PaperGraph
              papers={filteredPapers}
              connections={connections}
              onSelectPaper={selectPaper}
              selectedPaperId={selectedPaperId}
            />
          ) : selectedPaper ? (
            /* Reader only in list mode */
            <PaperReader paper={selectedPaper} />
          ) : null}

          {/* Graph overlay: paper count chips */}
          {view === "graph" && papers.length > 0 && (
            <div className="absolute bottom-6 left-6 flex gap-3">
              <div className="bg-surface/80 backdrop-blur border border-border px-4 py-2 text-xs tracking-wider text-text-muted">
                {papers.length} nodes / {connections.length} edges
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedPaper && (
          <>
            <ResizeHandle
              onResize={(delta) =>
                setDetailWidth((w) => Math.max(280, Math.min(700, w - delta)))
              }
            />
            <div style={{ width: detailWidth }} className="shrink-0 overflow-hidden">
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
          </>
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
