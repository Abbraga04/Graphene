-- Community features migration
-- Run this in your Supabase SQL Editor after the initial migration

-- Add public visibility to papers
ALTER TABLE papers ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paper stars (like GitHub stars)
CREATE TABLE IF NOT EXISTS paper_stars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_papers_is_public ON papers(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_stars_user ON paper_stars(user_id);
CREATE INDEX IF NOT EXISTS idx_stars_paper ON paper_stars(paper_id);
CREATE INDEX IF NOT EXISTS idx_stars_created ON paper_stars(created_at DESC);

-- View: paper star counts (materialized for performance)
CREATE OR REPLACE VIEW paper_star_counts AS
SELECT paper_id, COUNT(*) as star_count
FROM paper_stars
GROUP BY paper_id;
