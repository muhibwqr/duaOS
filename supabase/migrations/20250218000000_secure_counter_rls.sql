-- Secure counter + RLS migration for anonymous public usage.
-- Run after base schema (tables spiritual_assets, duas + match_documents, match_duas) exist.

-- 1. Aggregate counter table and view
CREATE TABLE IF NOT EXISTS public.dua_counter_daily (
  day date PRIMARY KEY,
  total_count bigint NOT NULL DEFAULT 0
);

-- Backfill from existing duas so ticker is accurate
INSERT INTO public.dua_counter_daily (day, total_count)
SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date, COUNT(*)
FROM public.duas
GROUP BY date_trunc('day', created_at AT TIME ZONE 'UTC')::date
ON CONFLICT (day) DO UPDATE SET total_count = public.dua_counter_daily.total_count + EXCLUDED.total_count;

-- Ticker view: total across all days
CREATE OR REPLACE VIEW public.dua_counter_total AS
SELECT COALESCE(SUM(total_count), 0)::bigint AS total
FROM public.dua_counter_daily;

-- 2. Constrained ingest RPC (no embedding; server adds embedding in a separate privileged step)
CREATE OR REPLACE FUNCTION public.ingest_dua_event(
  p_content text,
  p_intent text DEFAULT NULL,
  p_name_of_allah text DEFAULT NULL,
  p_hadith_snippet text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_meta jsonb;
BEGIN
  IF p_content IS NULL OR length(trim(p_content)) = 0 OR length(p_content) > 5000 THEN
    RAISE EXCEPTION 'invalid content';
  END IF;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'intent', CASE WHEN p_intent IN ('problem','refine','goal') THEN p_intent ELSE NULL END,
    'name_of_allah', left(nullif(trim(p_name_of_allah), ''), 2000),
    'hadith_snippet', left(nullif(trim(p_hadith_snippet), ''), 2000)
  ));

  INSERT INTO public.duas (content, metadata)
  VALUES (trim(p_content), v_meta)
  RETURNING id INTO v_id;

  INSERT INTO public.dua_counter_daily (day, total_count)
  VALUES (current_date, 1)
  ON CONFLICT (day)
  DO UPDATE SET total_count = public.dua_counter_daily.total_count + 1;

  RETURN v_id;
END;
$$;

-- 3. RLS on spiritual_assets (read-only for anon/authenticated)
ALTER TABLE public.spiritual_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spiritual_assets_select" ON public.spiritual_assets;
CREATE POLICY "spiritual_assets_select" ON public.spiritual_assets
  FOR SELECT TO anon, authenticated USING (true);

-- 4. RLS on duas (no direct anon/authenticated access; only service role / definer)
ALTER TABLE public.duas ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated => deny by default.
-- Service role bypasses RLS.

-- 4b. Check constraints on duas (content length; metadata normalized in ingest_dua_event)
ALTER TABLE public.duas DROP CONSTRAINT IF EXISTS duas_content_length;
ALTER TABLE public.duas ADD CONSTRAINT duas_content_length CHECK (length(content) > 0 AND length(content) <= 5000);

-- 5. Lock down function execution
REVOKE ALL ON FUNCTION public.ingest_dua_event(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_dua_event(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.ingest_dua_event(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_dua_event(text, text, text, text) TO service_role;

-- 6. Safe search_path for existing functions
CREATE OR REPLACE FUNCTION public.match_documents(
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
SECURITY INVOKER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.match_duas(
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
SECURITY INVOKER
SET search_path = public
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
