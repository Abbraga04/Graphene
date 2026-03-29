import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchArxivPaper } from "@/lib/arxiv";

// GET all papers
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("user_id");

  let query = supabase.from("papers").select("*").order("added_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);

  const { data: papers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const paperIds = (papers || []).map((p) => p.id);
  const { data: connections } = paperIds.length > 0
    ? await supabase.from("paper_connections").select("*").or(`paper_a.in.(${paperIds.join(",")}),paper_b.in.(${paperIds.join(",")})`)
    : { data: [] };

  return NextResponse.json({ papers: papers || [], connections: connections || [] });
}

// POST - add a new paper (fast insert, no AI blocking)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, user_id } = body;

  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 });
  }

  try {
    const isArxiv = url.includes("arxiv.org") || /^\d{4}\.\d{4,6}/.test(url);

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
          user_id: user_id || null,
        })
        .select()
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json({ paper: inserted });
    }

    // Non-arXiv URL — download PDF and store in Supabase
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

    // Download and upload PDF to Supabase Storage
    let storedPdfUrl = isPdf ? url : null;
    if (isPdf) {
      try {
        const pdfRes = await fetch(url);
        if (pdfRes.ok) {
          const buffer = Buffer.from(await pdfRes.arrayBuffer());
          const fileName = `${id}.pdf`;
          await supabase.storage.from("papers").upload(fileName, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
          const { data: publicUrl } = supabase.storage.from("papers").getPublicUrl(fileName);
          storedPdfUrl = publicUrl.publicUrl;
        }
      } catch (e) {
        console.error("PDF upload failed:", e);
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("papers")
      .insert({
        id,
        title: url.split("/").pop() || url,
        authors: [],
        source_url: url,
        pdf_url: storedPdfUrl,
        categories: [],
        user_id: user_id || null,
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
