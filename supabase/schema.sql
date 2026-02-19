-- Run in Supabase SQL Editor after: CREATE EXTENSION IF NOT EXISTS vector;
-- Then run migrations/20250218000000_secure_counter_rls.sql for RLS, ingest_dua_event RPC, dua_counter_daily, and dua_counter_total view.

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

-- Table for user-submitted du'as (for counter + similarity matching)
CREATE TABLE IF NOT EXISTS duas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS duas_embedding_idx
  ON duas USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_duas(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
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
    duas.id,
    duas.content,
    duas.metadata,
    1 - (duas.embedding <=> query_embedding) AS similarity
  FROM duas
  WHERE duas.embedding IS NOT NULL
    AND (1 - (duas.embedding <=> query_embedding)) >= match_threshold
  ORDER BY duas.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
