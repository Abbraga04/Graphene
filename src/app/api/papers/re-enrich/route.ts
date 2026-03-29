import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST() {
  const { data: papers } = await supabase
    .from("papers")
    .select("id, title, abstract, authors, categories")
    .order("added_at", { ascending: false });

  if (!papers || papers.length === 0) {
    return NextResponse.json({ message: "No papers" });
  }

  const results: { id: string; categories?: string[]; bs_score?: any; error?: string }[] = [];

  for (const paper of papers) {
    try {
      // Generate categories
      const catMsg = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: `Given this paper, return 2-4 short category labels. Pick from this list ONLY (use these exact strings): "AI", "Machine Learning", "NLP", "Computer Vision", "Reinforcement Learning", "Robotics", "Neuroscience", "Software Engineering", "Systems", "Security", "Databases", "HCI", "Optimization", "Mathematics", "Physics", "Biology", "Healthcare", "Finance", "Education", "Ethics". If none fit well, you may create ONE new short label. Return ONLY a JSON array.\n\nTitle: ${paper.title}\nAbstract: ${(paper.abstract || "").slice(0, 1000)}`,
          },
        ],
      });
      const catText = catMsg.content[0].type === "text" ? catMsg.content[0].text : "[]";
      const catMatch = catText.match(/\[[\s\S]*\]/);
      const categories = catMatch ? JSON.parse(catMatch[0]) : paper.categories;

      // Generate BS + interesting score
      const bsMsg = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 800,
        messages: [
          {
            role: "user",
            content: `You are a ruthlessly honest academic paper reviewer. Rate this paper. Return ONLY valid JSON:
{
  "overall": <0-100, 0 = seminal, 100 = pure BS>,
  "novelty": <0-100, 0 = genuinely new, 100 = rehash>,
  "rigor": <0-100, 0 = airtight, 100 = hand-wavy>,
  "overclaiming": <0-100, 0 = honest, 100 = massive overclaims>,
  "credibility": <0-100, 0 = established authors, 100 = unknown making wild claims>,
  "reproducibility": <0-100, 0 = code+data released, 100 = impossible to verify>,
  "verdict": "<one brutally honest sentence>",
  "interesting": <0-100, COMPLETELY INDEPENDENT from BS. Judge the IDEA and QUESTION, NOT execution. Fascinating question with bad execution = high interesting. Perfect execution on boring incremental work = low interesting. Would you want to discuss this over coffee?>,
  "interesting_why": "<one sentence on why the IDEA is or isn't compelling>"
}

Weighted BS: overclaiming 30%, rigor 25%, novelty 20%, credibility 15%, reproducibility 10%.
"Attention Is All You Need" = ~5 BS, ~95 interesting. fMRI for AI temporal reasoning = ~60 BS but ~80 interesting.

Authors: ${(paper.authors as string[])?.join(", ") || "unknown"}
Title: ${paper.title}
Abstract: ${(paper.abstract || "").slice(0, 3000)}`,
          },
        ],
      });
      const bsText = bsMsg.content[0].type === "text" ? bsMsg.content[0].text : "{}";
      const bsMatch = bsText.match(/\{[\s\S]*\}/);
      const bs_score = bsMatch ? JSON.parse(bsMatch[0]) : null;

      await supabase
        .from("papers")
        .update({ categories, ...(bs_score ? { bs_score } : {}) })
        .eq("id", paper.id);

      results.push({ id: paper.id, categories, bs_score });
    } catch (e) {
      results.push({ id: paper.id, error: String(e) });
    }
  }

  return NextResponse.json({ updated: results.length, results });
}
