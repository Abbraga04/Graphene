"use client";

import { useState, useRef, useEffect } from "react";
import { Paper, ChatMessage } from "@/lib/supabase";
import {
  X,
  BookOpen,
  Check,
  ExternalLink,
  FileText,
  Send,
  Loader2,
  MessageSquare,
  StickyNote,
} from "lucide-react";

export default function PaperDetail({
  paper,
  messages: initialMessages,
  onClose,
  onToggleRead,
  onUpdateNotes,
}: {
  paper: Paper;
  messages: ChatMessage[];
  onClose: () => void;
  onToggleRead: () => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "chat" | "notes">("overview");
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [notes, setNotes] = useState(paper.notes || "");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAsk = async () => {
    if (!question.trim() || chatLoading) return;
    const q = question.trim();
    setQuestion("");
    setChatLoading(true);

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      paper_id: paper.id,
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: paper.id, question: q }),
      });
      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `temp-${Date.now() + 1}`,
        paper_id: paper.id,
        role: "assistant",
        content: data.answer,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          paper_id: paper.id,
          role: "assistant",
          content: "Failed to get response. Try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSaveNotes = () => {
    onUpdateNotes(notes);
  };

  return (
    <div className="h-full flex flex-col bg-surface animate-slide-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-accent leading-tight">
              {paper.title}
            </h2>
            <p className="text-[10px] text-text mt-1">
              {(paper.authors as string[])?.join(", ")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-2 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={onToggleRead}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider uppercase border transition-colors ${
              paper.is_read
                ? "border-accent text-accent"
                : "border-border text-text hover:border-border-hover"
            }`}
          >
            {paper.is_read ? <Check size={10} /> : <BookOpen size={10} />}
            {paper.is_read ? "Read" : "Mark Read"}
          </button>
          {paper.pdf_url && (
            <a
              href={paper.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider uppercase border border-border text-text hover:border-border-hover transition-colors"
            >
              <FileText size={10} />
              PDF
            </a>
          )}
          {paper.source_url && (
            <a
              href={paper.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider uppercase border border-border text-text hover:border-border-hover transition-colors"
            >
              <ExternalLink size={10} />
              Source
            </a>
          )}
        </div>

        {/* Detail tabs */}
        <div className="flex gap-0 mt-3 -mb-4 border-b border-border -mx-5 px-5">
          {(["overview", "chat", "notes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] tracking-[0.2em] uppercase transition-colors ${
                tab === t
                  ? "text-accent border-b border-accent"
                  : "text-text hover:text-text"
              }`}
            >
              {t === "chat" && <MessageSquare size={10} />}
              {t === "notes" && <StickyNote size={10} />}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && (
          <div className="p-5 space-y-4">
            {/* Categories */}
            {(paper.categories as string[])?.length > 0 && (
              <div>
                <h3 className="text-[10px] text-text-dim tracking-[0.2em] uppercase mb-2">
                  Categories
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(paper.categories as string[]).map((cat) => (
                    <span
                      key={cat}
                      className="text-[10px] border border-border px-2 py-1 text-text"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Published */}
            {paper.published && (
              <div>
                <h3 className="text-[10px] text-text-dim tracking-[0.2em] uppercase mb-1">
                  Published
                </h3>
                <p className="text-xs text-text">
                  {new Date(paper.published).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}

            {/* AI Summary */}
            <div>
              <h3 className="text-[10px] text-text-dim tracking-[0.2em] uppercase mb-2">
                AI Summary
              </h3>
              {paper.summary ? (
                <div
                  className="text-xs text-text leading-relaxed border-l-2 border-border pl-3 summary-content"
                  dangerouslySetInnerHTML={{
                    __html: paper.summary
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text">$1</strong>')
                      .replace(/\*(.*?)\*/g, "<em>$1</em>")
                      .replace(/^[•\-]\s*/gm, "")
                      .split("\n")
                      .filter((l) => l.trim())
                      .map((l) => `<p style="margin-bottom: 8px">${l.trim()}</p>`)
                      .join(""),
                  }}
                />
              ) : (
                <div className="flex items-center gap-2 text-xs text-text-dim border-l-2 border-border pl-3 py-2">
                  <Loader2 size={12} className="animate-spin" />
                  Generating summary...
                </div>
              )}
            </div>

            {/* Abstract */}
            {paper.abstract && (
              <div>
                <h3 className="text-[10px] text-text-dim tracking-[0.2em] uppercase mb-2">
                  Abstract
                </h3>
                <p className="text-xs text-text leading-relaxed">
                  {paper.abstract}
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare size={24} className="mx-auto text-text-dim mb-2" />
                  <p className="text-xs text-text-dim tracking-wider">
                    Ask anything about this paper
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "text-accent pl-4 border-l border-accent"
                      : "text-text pl-4 border-l border-border"
                  }`}
                >
                  <span className="text-[9px] text-text-dim tracking-[0.2em] uppercase block mb-1">
                    {msg.role === "user" ? "You" : "Graphene AI"}
                  </span>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-text-dim text-xs pl-4">
                  <Loader2 size={12} className="animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div className="p-5">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Write your notes here..."
              className="w-full h-64 bg-bg border border-border p-4 text-xs text-text leading-relaxed resize-none focus:outline-none focus:border-border-hover"
            />
            <p className="text-[9px] text-text-dim mt-2 tracking-wider">
              Auto-saves on blur
            </p>
          </div>
        )}
      </div>

      {/* Chat input */}
      {tab === "chat" && (
        <div className="p-4 border-t border-border shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask about this paper..."
              className="flex-1 bg-bg border border-border px-3 py-2 text-xs text-text placeholder:text-text-dim focus:outline-none focus:border-border-hover"
            />
            <button
              onClick={handleAsk}
              disabled={chatLoading || !question.trim()}
              className="px-3 py-2 bg-accent text-bg hover:bg-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
