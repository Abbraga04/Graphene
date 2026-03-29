import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { chatAboutPaper } from "@/lib/ai";
import { getUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { paperId, question, history } = await req.json();

  if (!paperId || !question) {
    return NextResponse.json({ error: "paperId and question required" }, { status: 400 });
  }

  const { data: paper } = await supabase
    .from("papers")
    .select("*")
    .eq("id", paperId)
    .single();

  if (!paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  const answer = await chatAboutPaper(
    paper,
    (history || []) as { role: "user" | "assistant"; content: string }[],
    question
  );

  return NextResponse.json({ answer });
}
