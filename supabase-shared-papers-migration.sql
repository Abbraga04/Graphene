-- Shared papers model migration
-- Papers become shared resources; user-specific data moves to user_papers

-- 1. Create user_papers join table
CREATE TABLE IF NOT EXISTS user_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, paper_id)
);

-- 2. Migrate existing user-specific data from papers to user_papers
INSERT INTO user_papers (user_id, paper_id, is_read, read_at, notes, added_at)
SELECT user_id, id, is_read, read_at, notes, added_at
FROM papers
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, paper_id) DO NOTHING;

-- 3. Drop RLS policies that depend on user_id
DROP POLICY IF EXISTS papers_select ON papers;
DROP POLICY IF EXISTS papers_insert ON papers;
DROP POLICY IF EXISTS papers_update ON papers;
DROP POLICY IF EXISTS papers_delete ON papers;

-- 4. Drop user-specific columns from papers (they now live in user_papers)
ALTER TABLE papers DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE papers DROP COLUMN IF EXISTS is_read CASCADE;
ALTER TABLE papers DROP COLUMN IF EXISTS read_at CASCADE;
ALTER TABLE papers DROP COLUMN IF EXISTS notes CASCADE;

-- 5. Indexes for user_papers
CREATE INDEX IF NOT EXISTS idx_user_papers_user ON user_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_papers_paper ON user_papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_user_papers_added ON user_papers(added_at DESC);
