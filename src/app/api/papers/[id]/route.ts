import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

// GET single paper
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data: paper, error } = await supabase
    .from("papers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !paper) {
    return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  }

  // Get connections
  const { data: connections } = await supabase
    .from("paper_connections")
    .select("*")
    .or(`paper_a.eq.${id},paper_b.eq.${id}`);

  return NextResponse.json({
    paper,
    connections: connections || [],
  });
}

// PATCH - update paper (mark as read, add notes)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.is_read !== undefined) {
    updates.is_read = body.is_read;
    if (body.is_read) updates.read_at = new Date().toISOString();
  }
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.is_public !== undefined) updates.is_public = body.is_public;

  const { data, error } = await supabase
    .from("papers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paper: data });
}

// DELETE
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { error } = await supabase.from("papers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
