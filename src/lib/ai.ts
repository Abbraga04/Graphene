import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function summarizePaper(title: string, abstract: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Summarize this academic paper concisely in 3-4 bullet points. Focus on the key contribution, method, and results.

Title: ${title}

Abstract: ${abstract}`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

export async function chatAboutPaper(
  title: string,
  abstract: string,
  summary: string | null,
  history: { role: "user" | "assistant"; content: string }[],
  question: string
): Promise<string> {
  const systemPrompt = `You are a research assistant helping a user understand an academic paper. Be concise and precise. Use the paper context below to answer questions.

Paper: "${title}"

Abstract: ${abstract}

${summary ? `Summary: ${summary}` : ""}`;

  const messages = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: question },
  ];

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

export async function findConnections(
  newPaper: { title: string; abstract: string; categories: string[] },
  existingPapers: { id: string; title: string; abstract: string; categories: string[] }[]
): Promise<{ paperId: string; strength: number; relationType: string }[]> {
  if (existingPapers.length === 0) return [];

  const paperList = existingPapers
    .slice(0, 20)
    .map((p, i) => `[${i}] ID: ${p.id} | Title: ${p.title} | Categories: ${p.categories.join(", ")}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Given this new paper and a list of existing papers, identify which existing papers are related. Return a JSON array of connections.

New paper: "${newPaper.title}"
Abstract: ${newPaper.abstract?.slice(0, 500)}
Categories: ${newPaper.categories.join(", ")}

Existing papers:
${paperList}

Return ONLY a JSON array like: [{"index": 0, "strength": 0.8, "relation": "same_topic"}]
strength: 0-1 (how related)
relation: "same_topic", "cites", "similar_method", "same_field", "extends"
Only include papers with strength > 0.3`,
      },
    ],
  });

  const block = message.content[0];
  const text = block.type === "text" ? block.text : "[]";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed
      .filter((c: { index: number }) => c.index < existingPapers.length)
      .map((c: { index: number; strength: number; relation: string }) => ({
        paperId: existingPapers[c.index].id,
        strength: c.strength,
        relationType: c.relation,
      }));
  } catch {
    return [];
  }
}
