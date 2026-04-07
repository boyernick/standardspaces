-- Allow recommenders to optionally attach more reference links
-- (Instagram, Resy, news articles, etc.) alongside the primary URL.
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS additional_urls text[] NOT NULL DEFAULT '{}';
