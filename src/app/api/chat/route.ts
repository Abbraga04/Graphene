import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chatAboutPaper } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const { paperId, question } = await req.json();

  if (!paperId || !question) {
    return NextResponse.json({ error: "paperId and question required" }, { status: 400 });
  }

  // Get paper
  const { data: paper } = await supabase
    .from("papers")
    .select("*")
    .eq("id", paperId)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Get chat history
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("paper_id", paperId)
    .order("created_at", { ascending: true })
    .limit(20);

  // Get AI response
  const answer = await chatAboutPaper(
    paper.title,
    paper.abstract || "",
    paper.summary,
    (history || []) as { role: "user" | "assistant"; content: string }[],
    question
  );

  // Save both messages
  await supabase.from("chat_messages").insert([
    { paper_id: paperId, role: "user", content: question },
    { paper_id: paperId, role: "assistant", content: answer },
  ]);

  return NextResponse.json({ answer });
}
