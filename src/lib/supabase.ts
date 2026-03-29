import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-side client (bypasses RLS) — for API routes
export const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// Client-side client (respects RLS) — for browser auth
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Paper as returned by the API (shared paper + user-specific data merged)
export type Paper = {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  published: string | null;
  source_url: string | null;
  pdf_url: string | null;
  categories: string[];
  summary: string | null;
  embedding: number[] | null;
  added_at: string;
  is_public: boolean;
  // User-specific (merged from user_papers join)
  is_read: boolean;
  read_at: string | null;
  notes: string;
};

export type PaperConnection = {
  id: string;
  paper_a: string;
  paper_b: string;
  strength: number;
  relation_type: string;
};

export type ChatMessage = {
  id: string;
  paper_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PaperStar = {
  id: string;
  user_id: string;
  paper_id: string;
  created_at: string;
};
