"use client";

import { useState, useEffect } from "react";
import { Paper } from "@/lib/supabase";
import { FileText, Loader2 } from "lucide-react";

export default function PaperReader({ paper }: { paper: Paper }) {
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string>("pdf");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/papers/${encodeURIComponent(paper.id)}/viewer`)
      .then((r) => r.json())
      .then((data) => {
        setViewerUrl(data.url);
        setViewerType(data.type || "pdf");
      })
      .catch(() => {
        setViewerUrl(paper.pdf_url || paper.source_url);
        setViewerType("pdf");
      })
      .finally(() => setLoading(false));
  }, [paper.id, paper.pdf_url, paper.source_url]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <Loader2 size={20} className="animate-spin text-text-dim" />
      </div>
    );
  }

  if (!viewerUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <div className="text-center">
          <FileText size={32} className="mx-auto mb-3 text-text-dim" />
          <p className="text-xs text-text-dim tracking-wider uppercase">No content available</p>
        </div>
      </div>
    );
  }

  const src = viewerType === "pdf" ? `${viewerUrl}#toolbar=0&navpanes=0&view=FitH` : viewerUrl;

  return (
    <div className="w-full h-full">
      <iframe
        src={src}
        className="w-full h-full border-none"
        title={paper.title}
        sandbox={viewerType === "html" ? "allow-same-origin allow-scripts allow-popups" : undefined}
      />
    </div>
  );
}
