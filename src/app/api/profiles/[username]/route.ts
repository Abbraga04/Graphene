import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET public profile by username
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Get their public starred papers
  const { data: stars } = await supabase
    .from("paper_stars")
    .select("paper_id, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  let starredPapers: any[] = [];
  if (stars && stars.length > 0) {
    const paperIds = stars.map((s) => s.paper_id);
    const { data: papers } = await supabase
      .from("papers")
      .select("id, title, authors, categories, published, is_public, bs_score")
      .in("id", paperIds)
      .eq("is_public", true);
    starredPapers = papers || [];
  }

  // Get their public papers
  const { data: publicPapers } = await supabase
    .from("papers")
    .select("id, title, authors, categories, published, bs_score")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("added_at", { ascending: false })
    .limit(50);

  // Count stats
  const { count: totalStarsGiven } = await supabase
    .from("paper_stars")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id);

  const { count: totalPapersPublic } = await supabase
    .from("papers")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_public", true);

  return NextResponse.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
    },
    starred_papers: starredPapers,
    public_papers: publicPapers || [],
    stats: {
      stars_given: totalStarsGiven || 0,
      public_papers: totalPapersPublic || 0,
    },
  });
}
