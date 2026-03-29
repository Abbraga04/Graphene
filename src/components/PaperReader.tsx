"use client";

import { useState, useEffect } from "react";
import { Paper } from "@/lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";

export default function PaperReader({ paper }: { paper: Paper }) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setHtml(null);

    fetch(`/api/papers/${encodeURIComponent(paper.id)}/content`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setHtml(data.html);
        }
      })
      .catch(() => setError("Failed to load paper content"))
      .finally(() => setLoading(false));
  }, [paper.id]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-text-dim mx-auto mb-3" />
          <p className="text-xs text-text-dim tracking-wider uppercase">
            Parsing paper...
          </p>
          <p className="text-[10px] text-text-dim mt-1">
            Converting PDF to readable format
          </p>
        </div>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg">
        <div className="text-center">
          <AlertCircle size={24} className="text-text-dim mx-auto mb-3" />
          <p className="text-xs text-text-dim tracking-wider">
            {error || "No content available"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-bg">
      <article
        className="paper-reader max-w-3xl mx-auto px-12 py-16"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <style jsx global>{`
        .paper-reader {
          font-family: "Georgia", "Times New Roman", serif;
          color: #d4d4d4;
          line-height: 1.8;
          font-size: 15px;
        }

        .paper-reader h1 {
          font-family: var(--font-mono);
          font-size: 28px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 8px;
          line-height: 1.3;
          letter-spacing: -0.02em;
          border-bottom: 1px solid #222;
          padding-bottom: 16px;
        }

        .paper-reader .authors {
          font-family: var(--font-mono);
          font-size: 13px;
          color: #888;
          margin-bottom: 4px;
          letter-spacing: 0.02em;
        }

        .paper-reader .affiliation {
          font-family: var(--font-mono);
          font-size: 11px;
          color: #555;
          margin-bottom: 24px;
          letter-spacing: 0.02em;
        }

        .paper-reader h2 {
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 600;
          color: #ffffff;
          margin-top: 48px;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #1a1a1a;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .paper-reader h3 {
          font-family: var(--font-mono);
          font-size: 15px;
          font-weight: 500;
          color: #ccc;
          margin-top: 32px;
          margin-bottom: 12px;
          letter-spacing: 0.03em;
        }

        .paper-reader h4 {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 500;
          color: #aaa;
          margin-top: 24px;
          margin-bottom: 8px;
        }

        .paper-reader p {
          margin-bottom: 16px;
          text-align: justify;
          hyphens: auto;
        }

        .paper-reader ul,
        .paper-reader ol {
          margin-bottom: 16px;
          padding-left: 24px;
        }

        .paper-reader li {
          margin-bottom: 6px;
        }

        .paper-reader blockquote {
          border-left: 2px solid #333;
          padding-left: 16px;
          margin: 24px 0;
          color: #999;
          font-style: italic;
        }

        .paper-reader strong {
          color: #fff;
          font-weight: 600;
        }

        .paper-reader em {
          color: #bbb;
        }

        .paper-reader .citation {
          color: #666;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .paper-reader .math {
          font-family: "Cambria Math", "Times New Roman", serif;
          font-style: italic;
          color: #ccc;
        }

        .paper-reader figure {
          margin: 32px 0;
          padding: 16px;
          border: 1px solid #1a1a1a;
          background: #0a0a0a;
        }

        .paper-reader figcaption {
          font-family: var(--font-mono);
          font-size: 11px;
          color: #666;
          margin-top: 8px;
          letter-spacing: 0.02em;
        }

        .paper-reader table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 13px;
        }

        .paper-reader th,
        .paper-reader td {
          border: 1px solid #222;
          padding: 8px 12px;
          text-align: left;
        }

        .paper-reader th {
          background: #0a0a0a;
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #888;
        }

        .paper-reader a {
          color: #888;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .paper-reader a:hover {
          color: #fff;
        }

        .paper-reader hr {
          border: none;
          border-top: 1px solid #1a1a1a;
          margin: 32px 0;
        }

        .paper-reader sup {
          font-size: 10px;
          color: #666;
        }
      `}</style>
    </div>
  );
}
