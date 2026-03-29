import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchArxivPaper } from "@/lib/arxiv";

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

// POST - add a new paper (fast insert, no AI blocking)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url } = body;

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
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
        return NextResponse.json({ paper: existing, alreadyExists: true }, { status: 200 });
      }

      // Insert immediately with arxiv metadata — no AI yet
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
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ paper: inserted });
    }

    // Non-arXiv URL — insert immediately with URL as title
    const id = `web-${Date.now()}`;
    const isPdf = url.toLowerCase().endsWith(".pdf") || url.includes("/pdf/");

    const { data: existing } = await supabase
      .from("papers")
      .select("id")
      .eq("source_url", url)
      .single();

    if (existing) {
      return NextResponse.json({ paper: existing, alreadyExists: true }, { status: 200 });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("papers")
      .insert({
        id,
        title: url.split("/").pop() || url,
        authors: [],
        source_url: url,
        pdf_url: isPdf ? url : null,
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
