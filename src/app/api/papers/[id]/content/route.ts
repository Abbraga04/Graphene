import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: paper } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }


  const pdfUrl = paper.pdf_url || paper.source_url;
  if (!pdfUrl) {
    return NextResponse.json({ error: "No PDF URL" }, { status: 400 });
  }

  try {
    // Fetch and parse PDF
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) throw new Error("Failed to fetch PDF");
    const buffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfParse = await import("pdf-parse");
    const parse = typeof pdfParse === "function" ? pdfParse : (pdfParse as { default: Function }).default;
    const pdfData = await (parse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    const text = pdfData.text;

    // Use Claude to convert to clean HTML
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `Convert this academic paper text into clean, well-structured HTML. Use semantic HTML tags. Do NOT include <html>, <head>, or <body> tags — just the content.

Rules:
- Use <h1> for the paper title
- Use <p class="authors"> for authors
- Use <p class="affiliation"> for affiliations
- Use <h2> for major sections (Abstract, Introduction, etc.)
- Use <h3> for subsections
- Use <p> for paragraphs
- Use <ul>/<ol> for lists
- Use <figure> with <figcaption> for figure/table references
- Use <blockquote> for important quotes
- Use <strong> and <em> for emphasis
- Use <span class="citation"> for citations like [1], [Author 2020]
- Use <span class="math"> for mathematical expressions
- Clean up any PDF artifacts (hyphenation at line breaks, weird spacing)
- Preserve the logical structure and flow of the paper
- Do NOT add any content that isn't in the original text

Paper text:
${text.slice(0, 30000)}`,
        },
      ],
    });

    const block = message.content[0];
    const html = block.type === "text" ? block.text : "";

    // Extract just the HTML content (remove any markdown code fences)
    const cleanHtml = html
      .replace(/^```html?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return NextResponse.json({ html: cleanHtml });
  } catch (e) {
    console.error("Content parsing failed:", e);
    return NextResponse.json({ error: "Failed to parse paper" }, { status: 500 });
  }
}
