import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

// GET public feed - trending and recent papers
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  const { searchParams } = new URL(req.url);
  const sort = searchParams.get("sort") || "trending";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
  const offset = parseInt(searchParams.get("offset") || "0");

  // Get public papers
  const { data: papers, error } = await supabase
    .from("papers")
    .select("id, title, authors, abstract, categories, published, added_at, bs_score, source_url")
    .eq("is_public", true)
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!papers || papers.length === 0) return NextResponse.json({ papers: [] });

  // Get star counts for these papers
  const paperIds = papers.map((p) => p.id);
  const { data: starCounts } = await supabase
    .from("paper_stars")
    .select("paper_id")
    .in("paper_id", paperIds);

  const countMap: Record<string, number> = {};
  (starCounts || []).forEach((s) => {
    countMap[s.paper_id] = (countMap[s.paper_id] || 0) + 1;
  });

  // Check which papers the current user has starred
  let userStars = new Set<string>();
  if (user) {
    const { data: starred } = await supabase
      .from("paper_stars")
      .select("paper_id")
      .eq("user_id", user.id)
      .in("paper_id", paperIds);
    userStars = new Set((starred || []).map((s) => s.paper_id));
  }

  // Find who first added each paper (the "contributor")
  const { data: firstAdders } = await supabase
    .from("user_papers")
    .select("paper_id, user_id, added_at")
    .in("paper_id", paperIds)
    .order("added_at", { ascending: true });

  // Get first adder per paper
  const firstAdderMap: Record<string, string> = {};
  (firstAdders || []).forEach((ua) => {
    if (!firstAdderMap[ua.paper_id]) {
      firstAdderMap[ua.paper_id] = ua.user_id;
    }
  });

  // Get profiles for first adders
  const adderIds = [...new Set(Object.values(firstAdderMap))];
  let profileMap: Record<string, { username: string; display_name: string | null; is_verified: boolean }> = {};
  if (adderIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, is_verified")
      .in("id", adderIds);
    (profiles || []).forEach((p) => {
      profileMap[p.id] = { username: p.username, display_name: p.display_name, is_verified: p.is_verified || false };
    });
  }

  // Enrich papers with star data and contributor profile
  let enriched = papers.map((p) => {
    const adderId = firstAdderMap[p.id];
    return {
      ...p,
      star_count: countMap[p.id] || 0,
      starred: userStars.has(p.id),
      owner: adderId ? profileMap[adderId] || null : null,
    };
  });

  // Sort
  if (sort === "trending") {
    enriched.sort((a, b) => b.star_count - a.star_count || new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
  } else if (sort === "stars") {
    enriched.sort((a, b) => b.star_count - a.star_count);
  }

  return NextResponse.json({ papers: enriched });
}
