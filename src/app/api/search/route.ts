import { NextRequest, NextResponse } from "next/server";
import { searchArxiv } from "@/lib/arxiv";
import { getUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  try {
    const results = await searchArxiv(query, 15);
    return NextResponse.json({ results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
