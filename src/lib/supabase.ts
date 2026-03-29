import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  read_at: string | null;
  is_read: boolean;
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
