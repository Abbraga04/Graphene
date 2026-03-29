import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchArxivPaper } from "@/lib/arxiv";
import { summarizePaper, findConnections } from "@/lib/ai";

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

    // For non-arxiv URLs, create a basic entry
    const id = `web-${Date.now()}`;
    const { data: inserted, error: insertError } = await supabase
      .from("papers")
      .insert({
        id,
        title: url,
        authors: [],
        source_url: url,
        pdf_url: url,
        categories: [],
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ paper: inserted });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to add paper" }, { status: 500 });
  }
}
