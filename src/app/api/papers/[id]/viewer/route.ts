import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: paper } = await supabase
    .from("papers")
    .select("id, pdf_url, source_url")
    .eq("id", id)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isArxiv = !id.startsWith("web-");

  if (isArxiv) {
    // Check if HTML version exists
    const htmlUrl = `https://arxiv.org/html/${id}`;
    try {
      const res = await fetch(htmlUrl, { method: "HEAD" });
      if (res.ok && !res.url.includes("unavailable")) {
        return NextResponse.json({ url: htmlUrl, type: "html" });
      }
    } catch {}

    // Fall back to PDF
    const pdfUrl = paper.pdf_url || `https://arxiv.org/pdf/${id}`;
    return NextResponse.json({ url: pdfUrl, type: "pdf" });
  }

  // Non-arxiv
  const url = paper.pdf_url || paper.source_url;
  return NextResponse.json({ url, type: paper.pdf_url ? "pdf" : "page" });
}
