import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at, is_verified")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q.trim()) {
    // Search by username or display name
    query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data: profiles, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get paper counts and star counts for each profile
  const profileIds = (profiles || []).map((p) => p.id);
  if (profileIds.length === 0) return NextResponse.json({ profiles: [] });

  // Count public papers per user
  const { data: userPapers } = await supabase
    .from("user_papers")
    .select("user_id, paper_id")
    .in("user_id", profileIds);

  // Get which of those papers are public
  const allPaperIds = [...new Set((userPapers || []).map((up) => up.paper_id))];
  let publicPaperIds = new Set<string>();
  if (allPaperIds.length > 0) {
    const { data: publicPapers } = await supabase
      .from("papers")
      .select("id")
      .in("id", allPaperIds)
      .eq("is_public", true);
    publicPaperIds = new Set((publicPapers || []).map((p) => p.id));
  }

  const paperCountMap: Record<string, number> = {};
  (userPapers || []).forEach((up) => {
    if (publicPaperIds.has(up.paper_id)) {
      paperCountMap[up.user_id] = (paperCountMap[up.user_id] || 0) + 1;
    }
  });

  // Count stars given per user
  const { data: stars } = await supabase
    .from("paper_stars")
    .select("user_id")
    .in("user_id", profileIds);

  const starCountMap: Record<string, number> = {};
  (stars || []).forEach((s) => {
    starCountMap[s.user_id] = (starCountMap[s.user_id] || 0) + 1;
  });

  const enriched = (profiles || []).map((p) => ({
    ...p,
    paper_count: paperCountMap[p.id] || 0,
    stars_given: starCountMap[p.id] || 0,
  }));

  return NextResponse.json({ profiles: enriched });
}
