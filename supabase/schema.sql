-- Run in Supabase SQL Editor after: CREATE EXTENSION IF NOT EXISTS vector;

-- Table for names/hadith + embeddings
CREATE TABLE IF NOT EXISTS spiritual_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast similarity search
CREATE INDEX IF NOT EXISTS spiritual_assets_embedding_idx
  ON spiritual_assets USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RPC: find top matches by embedding
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_metadata jsonb DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    spiritual_assets.id,
    spiritual_assets.content,
    spiritual_assets.metadata,
    1 - (spiritual_assets.embedding <=> query_embedding) AS similarity
  FROM spiritual_assets
  WHERE spiritual_assets.embedding IS NOT NULL
    AND (filter_metadata = '{}' OR spiritual_assets.metadata @> filter_metadata)
    AND (1 - (spiritual_assets.embedding <=> query_embedding)) >= match_threshold
  ORDER BY spiritual_assets.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
