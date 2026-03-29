import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: paper } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single();

  if (!paper) {
    return new Response(JSON.stringify({ error: "Paper not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Already enriched
  if (paper.summary) {
    return new Response(JSON.stringify({ done: true, summary: paper.summary }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // For non-arxiv PDFs, extract metadata first
  const isWebPaper = id.startsWith("web-");
  let title = paper.title;
  let abstract = paper.abstract || "";
  let authors = paper.authors || [];
  let categories = paper.categories || [];
  let published = paper.published;

  if (isWebPaper) {
    let extractedText = "";
    const sourceUrl = paper.source_url || paper.pdf_url;

    // Try HTML scraping first (faster, preserves structure)
    if (sourceUrl && !sourceUrl.toLowerCase().endsWith(".pdf")) {
      try {
        const pageRes = await fetch(sourceUrl);
        if (pageRes.ok) {
          const html = await pageRes.text();
          extractedText = html
            .replace(/<script[\s\S]*?<\/script>/gi, "")
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      } catch (e) {
        console.error("HTML scraping failed:", e);
      }
    }

    // Fall back to PDF parsing if no usable HTML
    if (extractedText.length < 200 && paper.pdf_url) {
      try {
        const pdfRes = await fetch(paper.pdf_url);
        if (pdfRes.ok) {
          const buffer = Buffer.from(await pdfRes.arrayBuffer());
          const pdfParse = await import("pdf-parse");
          const parse =
            typeof pdfParse === "function"
              ? pdfParse
              : (pdfParse as { default: Function }).default;
          const pdfData = await (
            parse as (buf: Buffer) => Promise<{ text: string }>
          )(buffer);
          extractedText = pdfData.text;
        }
      } catch (e) {
        console.error("PDF parsing failed:", e);
      }
    }

    // Extract metadata with Claude
    if (extractedText.length > 100) {
      try {
        const metaMsg = await client.messages.create({
          model: "claude-opus-4-6",
          max_tokens: 512,
          messages: [
            {
              role: "user",
              content: `Extract metadata from this paper/article. Return ONLY JSON: {"title":"...","authors":["..."],"abstract":"...","categories":["..."],"published":"YYYY-MM-DD or null"}\n\n${extractedText.slice(0, 6000)}`,
            },
          ],
        });
        const metaText =
          metaMsg.content[0].type === "text" ? metaMsg.content[0].text : "{}";
        const jsonMatch = metaText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const meta = JSON.parse(jsonMatch[0]);
          title = meta.title || title;
          authors = meta.authors || authors;
          abstract = meta.abstract || abstract;
          categories = meta.categories || categories;
          published = meta.published || published;

          await supabase
            .from("papers")
            .update({ title, authors, abstract, categories, published })
            .eq("id", id);
        }
      } catch (e) {
        console.error("Metadata extraction failed:", e);
      }
    }
  }

  // Stream the summary generation
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send metadata update if we extracted it
      if (isWebPaper && title !== paper.title) {
        send("metadata", { title, authors, abstract, categories, published });
      }

      // Stream summary
      send("status", { step: "summarizing" });
      try {
        const summaryStream = client.messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: `Summarize this academic paper in 3-4 concise bullet points. Focus on key contribution, method, and results. Do NOT use markdown bold (**). Use plain text only.\n\nTitle: ${title}\n\nAbstract: ${abstract}`,
            },
          ],
        });

        let fullSummary = "";
        for await (const event of summaryStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullSummary += event.delta.text;
            send("summary_chunk", { text: event.delta.text });
          }
        }

        // Save summary
        await supabase
          .from("papers")
          .update({ summary: fullSummary })
          .eq("id", id);

        send("summary_done", { summary: fullSummary });
      } catch (e) {
        console.error("Summary streaming failed:", e);
        send("error", { message: "Summary generation failed" });
      }

      // Find connections (non-streaming, quick)
      send("status", { step: "finding_connections" });
      try {
        const { data: existingPapers } = await supabase
          .from("papers")
          .select("id, title, abstract, categories")
          .neq("id", id)
          .limit(20);

        if (existingPapers && existingPapers.length > 0 && abstract) {
          const paperList = existingPapers
            .map(
              (p, i) =>
                `[${i}] ${p.title} | ${(p.categories as string[])?.join(", ") || ""}`
            )
            .join("\n");

          const connMsg = await client.messages.create({
            model: "claude-opus-4-6",
            max_tokens: 512,
            messages: [
              {
                role: "user",
                content: `Given this new paper and existing papers, identify related ones. Return ONLY JSON array: [{"index":0,"strength":0.8,"relation":"same_topic"}]\nstrength: 0-1, relation: same_topic|similar_method|same_field|extends\nOnly include strength > 0.3\n\nNew: "${title}"\nAbstract: ${abstract.slice(0, 500)}\nCategories: ${(categories as string[])?.join(", ")}\n\nExisting:\n${paperList}`,
              },
            ],
          });

          const connText =
            connMsg.content[0].type === "text" ? connMsg.content[0].text : "[]";
          const connMatch = connText.match(/\[[\s\S]*\]/);
          if (connMatch) {
            const parsed = JSON.parse(connMatch[0]);
            const connections = parsed
              .filter(
                (c: { index: number }) => c.index < existingPapers.length
              )
              .map(
                (c: {
                  index: number;
                  strength: number;
                  relation: string;
                }) => ({
                  paper_a: id,
                  paper_b: existingPapers[c.index].id,
                  strength: c.strength,
                  relation_type: c.relation,
                })
              );

            if (connections.length > 0) {
              await supabase.from("paper_connections").insert(connections);
              send("connections", { count: connections.length });
            }
          }
        }
      } catch (e) {
        console.error("Connection finding failed:", e);
      }

      send("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
