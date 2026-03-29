-- Run this in your Supabase SQL Editor to set up the database

-- Papers table
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]',
  abstract TEXT,
  published TIMESTAMPTZ,
  source_url TEXT,
  pdf_url TEXT,
  categories JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  embedding VECTOR(1536),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT ''
);

-- Paper connections for the 3D graph
CREATE TABLE IF NOT EXISTS paper_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_a TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  paper_b TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  strength REAL DEFAULT 0.5,
  relation_type TEXT DEFAULT 'similar',
  UNIQUE(paper_a, paper_b)
);

-- Chat messages for AI Q&A per paper
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_papers_added_at ON papers(added_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_is_read ON papers(is_read);
CREATE INDEX IF NOT EXISTS idx_connections_paper_a ON paper_connections(paper_a);
CREATE INDEX IF NOT EXISTS idx_connections_paper_b ON paper_connections(paper_b);
CREATE INDEX IF NOT EXISTS idx_chat_paper_id ON chat_messages(paper_id);

-- Enable the vector extension (for embeddings similarity search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Similarity search function
CREATE OR REPLACE FUNCTION match_papers(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    papers.id,
    papers.title,
    1 - (papers.embedding <=> query_embedding) AS similarity
  FROM papers
  WHERE papers.embedding IS NOT NULL
    AND 1 - (papers.embedding <=> query_embedding) > match_threshold
  ORDER BY papers.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
