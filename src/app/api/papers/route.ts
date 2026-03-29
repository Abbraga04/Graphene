import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchArxivPaper } from "@/lib/arxiv";
import { summarizePaper, findConnections, extractPaperMetadata } from "@/lib/ai";

// GET all papers
export async function GET() {
  const { data: papers, error } = await supabase
    .from("papers")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: connections } = await supabase.from("paper_connections").select("*");

  return NextResponse.json({ papers: papers || [], connections: connections || [] });
}

// POST - add a new paper
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
    // Check if it's an arxiv URL or ID
    const isArxiv = url.includes("arxiv.org") || /^\d{4}\.\d{4,5}/.test(url);

    if (isArxiv) {
      const paper = await fetchArxivPaper(url);
      if (!paper) {
        return NextResponse.json({ error: "Paper not found on arxiv" }, { status: 404 });
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from("papers")
        .select("id")
        .eq("id", paper.id)
        .single();

      if (existing) {
        return NextResponse.json({ error: "Paper already added", paper: existing }, { status: 409 });
      }

      // Generate summary
      let summary = null;
      try {
        summary = await summarizePaper(paper.title, paper.abstract);
      } catch (e) {
        console.error("Summary generation failed:", e);
      }

      // Insert paper
      const { data: inserted, error: insertError } = await supabase
        .from("papers")
        .insert({
          id: paper.id,
          title: paper.title,
          authors: paper.authors,
          abstract: paper.abstract,
          published: paper.published,
          source_url: paper.sourceUrl,
          pdf_url: paper.pdfUrl,
          categories: paper.categories,
          summary,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Find connections to existing papers
      try {
        const { data: existingPapers } = await supabase
          .from("papers")
          .select("id, title, abstract, categories")
          .neq("id", paper.id);

        if (existingPapers && existingPapers.length > 0) {
          const connections = await findConnections(
            { title: paper.title, abstract: paper.abstract, categories: paper.categories },
            existingPapers
          );

          if (connections.length > 0) {
            await supabase.from("paper_connections").insert(
              connections.map((c) => ({
                paper_a: paper.id,
                paper_b: c.paperId,
                strength: c.strength,
                relation_type: c.relationType,
              }))
            );
          }
        }
      } catch (e) {
        console.error("Connection finding failed:", e);
      }

      return NextResponse.json({ paper: inserted });
    }

    // For any other URL — try to fetch and extract
    const id = `web-${Date.now()}`;
    const isPdf = url.toLowerCase().endsWith(".pdf") || url.includes("/pdf/");

    let title = url;
    let authors: string[] = [];
    let abstract: string | null = null;
    let categories: string[] = [];
    let published: string | null = null;
    let summary: string | null = null;

    if (isPdf) {
      try {
        // Fetch the PDF
        const pdfRes = await fetch(url);
        if (!pdfRes.ok) throw new Error(`Failed to fetch PDF: ${pdfRes.status}`);
        const buffer = Buffer.from(await pdfRes.arrayBuffer());
        const pdfParse = await import("pdf-parse");
        const parse = typeof pdfParse === "function" ? pdfParse : (pdfParse as { default: typeof import("pdf-parse") }).default;
        const pdfData = await (parse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
        const text = pdfData.text;

        // Use AI to extract metadata
        const metadata = await extractPaperMetadata(text);
        title = metadata.title;
        authors = metadata.authors;
        abstract = metadata.abstract;
        categories = metadata.categories;
        published = metadata.published;

        // Generate summary
        try {
          summary = await summarizePaper(title, abstract || text.slice(0, 2000));
        } catch (e) {
          console.error("Summary generation failed:", e);
        }
      } catch (e) {
        console.error("PDF extraction failed:", e);
        // Fall back to just storing the URL
      }
    } else {
      // Regular webpage — try to fetch and extract text
      try {
        const pageRes = await fetch(url);
        const html = await pageRes.text();
        // Extract title from HTML
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        // Try to extract any meaningful text
        const bodyText = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000);

        if (bodyText.length > 100) {
          const metadata = await extractPaperMetadata(bodyText);
          if (metadata.title !== "Untitled") title = metadata.title;
          authors = metadata.authors;
          abstract = metadata.abstract;
          categories = metadata.categories;
          published = metadata.published;

          try {
            summary = await summarizePaper(title, abstract || bodyText.slice(0, 2000));
          } catch (e) {
            console.error("Summary generation failed:", e);
          }
        }
      } catch (e) {
        console.error("Page fetch failed:", e);
      }
    }

    // Check if already exists by URL
    const { data: existing } = await supabase
      .from("papers")
      .select("id")
      .eq("source_url", url)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Paper already added", paper: existing }, { status: 409 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("papers")
      .insert({
        id,
        title,
        authors,
        abstract,
        published,
        source_url: url,
        pdf_url: isPdf ? url : null,
        categories,
        summary,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Find connections to existing papers
    try {
      const { data: existingPapers } = await supabase
        .from("papers")
        .select("id, title, abstract, categories")
        .neq("id", id);

      if (existingPapers && existingPapers.length > 0 && abstract) {
        const connections = await findConnections(
          { title, abstract, categories },
          existingPapers
        );

        if (connections.length > 0) {
          await supabase.from("paper_connections").insert(
            connections.map((c) => ({
              paper_a: id,
              paper_b: c.paperId,
              strength: c.strength,
              relation_type: c.relationType,
            }))
          );
        }
      }
    } catch (e) {
      console.error("Connection finding failed:", e);
    }

    return NextResponse.json({ paper: inserted });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to add paper" }, { status: 500 });
  }
}
