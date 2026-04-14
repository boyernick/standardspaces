-- Hybrid search: extend `match_spots` with structured pre-filters so vector
-- similarity ranks only candidates that satisfy the hard constraints parsed
-- out of the query (neighborhood, city, category). Without this, the RPC
-- returns the K nearest vectors regardless of whether they meet the user's
-- explicit intent — e.g. "drinks in wynwood" happily returning Brickell bars
-- because `gte-small` embeds the two queries nearly identically.
--
-- See src/lib/search-query-parser.ts for the parser that produces these
-- filters. Filters are NULL-passthrough: callers omit them when they don't
-- apply, and the query plan degrades to the unfiltered behavior.

-- Drop the old signature so we don't leave an ambiguous overload behind.
drop function if exists public.match_spots(vector, int, float);

create or replace function public.match_spots(
  query_embedding vector(384),
  match_count int default 8,
  min_similarity float default 0.25,
  filter_neighborhoods text[] default null,
  filter_cities text[] default null,
  filter_categories text[] default null
)
returns table (id text, similarity float)
language sql
stable
as $$
  select
    s.id,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.spots s
  where s.embedding is not null
    and 1 - (s.embedding <=> query_embedding) >= min_similarity
    and (
      filter_neighborhoods is null
      or array_length(filter_neighborhoods, 1) is null
      or lower(s.neighborhood) = any (
        select lower(n) from unnest(filter_neighborhoods) as n
      )
    )
    and (
      filter_cities is null
      or array_length(filter_cities, 1) is null
      or lower(s.city) = any (
        select lower(c) from unnest(filter_cities) as c
      )
    )
    and (
      filter_categories is null
      or array_length(filter_categories, 1) is null
      or s.category && filter_categories
    )
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_spots(vector, int, float, text[], text[], text[])
  to authenticated;
