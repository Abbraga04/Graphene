import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

// GET star count + whether current user has starred
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  const { id } = await params;

  const { count } = await supabase
    .from("paper_stars")
    .select("*", { count: "exact", head: true })
    .eq("paper_id", id);

  let starred = false;
  if (user) {
    const { data } = await supabase
      .from("paper_stars")
      .select("id")
      .eq("paper_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    starred = !!data;
  }

  return NextResponse.json({ star_count: count || 0, starred });
}

// POST - star a paper
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Verify paper exists and is public (or owned by user)
  const { data: paper } = await supabase
    .from("papers")
    .select("id, user_id, is_public")
    .eq("id", id)
    .single();

  if (!paper) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  if (!paper.is_public && paper.user_id !== user.id) {
    return NextResponse.json({ error: "Paper is not public" }, { status: 403 });
  }

  const { error } = await supabase
    .from("paper_stars")
    .upsert({ user_id: user.id, paper_id: id }, { onConflict: "user_id,paper_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("paper_stars")
    .select("*", { count: "exact", head: true })
    .eq("paper_id", id);

  return NextResponse.json({ starred: true, star_count: count || 0 });
}

// DELETE - unstar a paper
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { error } = await supabase
    .from("paper_stars")
    .delete()
    .eq("user_id", user.id)
    .eq("paper_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await supabase
    .from("paper_stars")
    .select("*", { count: "exact", head: true })
    .eq("paper_id", id);

  return NextResponse.json({ starred: false, star_count: count || 0 });
}
