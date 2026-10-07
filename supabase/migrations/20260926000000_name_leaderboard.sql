-- Read-only leaderboard view: most invoked Names of Allah across stored du'as.
-- Only aggregated counts are exposed; contents and metadata stay private (RLS on duas).

CREATE OR REPLACE VIEW public.dua_name_leaderboard AS
SELECT metadata->>'name_of_allah' AS name_of_allah, COUNT(*)::bigint AS total, MAX(created_at) AS last_at
FROM public.duas
WHERE metadata->>'name_of_allah' IS NOT NULL AND length(metadata->>'name_of_allah') > 0
GROUP BY 1;

REVOKE ALL ON public.dua_name_leaderboard FROM anon, authenticated;
