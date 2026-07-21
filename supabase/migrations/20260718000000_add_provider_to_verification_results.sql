-- Record which analysis engine produced a result so the UI can show whether it
-- was a live AI analysis or an offline heuristic fallback. Nullable for old rows.
ALTER TABLE public.verification_results
  ADD COLUMN IF NOT EXISTS provider TEXT;
2