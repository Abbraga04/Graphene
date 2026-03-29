"use client";

import { Paper } from "@/lib/supabase";
import { FileText } from "lucide-react";

function isArxivPaper(paper: Paper): boolean {
  return !paper.id.startsWith("web-");
}

function getArxivHtmlUrl(arxivId: string): string {
  return `https://arxiv.org/html/${arxivId}`;
}

export default function PaperReader({ paper }: { paper: Paper }) {
  if (isArxivPaper(paper)) {
    // ArXiv papers — use the official HTML version with images, math, etc.
    const htmlUrl = getArxivHtmlUrl(paper.id);
    return (
      <div className="w-full h-full">
        <iframe
          src={htmlUrl}
          className="w-full h-full border-none"
          title={paper.title}
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </div>
    );
  }

  // Non-arXiv papers — embed the PDF directly
  const viewUrl = paper.pdf_url || paper.source_url;

  if (!viewUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <div className="text-center">
          <FileText size={32} className="mx-auto mb-3 text-text-dim" />
          <p className="text-xs text-text-dim tracking-wider uppercase">
            No PDF available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        src={`${viewUrl}#toolbar=0&navpanes=0&view=FitH`}
        className="w-full h-full border-none"
        title={paper.title}
      />
    </div>
  );
}
