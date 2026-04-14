-- Semantic search for spots via pgvector.
-- Embeddings are produced by OpenAI text-embedding-3-small (1536 dims) on
-- publish and on listing edit. Query embeddings are produced server-side
-- in /api/search/semantic. See src/lib/embeddings.ts.

create extension if not exists vector;

alter table public.spots
  add column if not exists embedding vector(1536),
  add column if not exists embedding_source text,
  add column if not exists embedding_updated_at timestamptz;

-- HNSW is the right choice at this scale — no training step, good recall at
-- low k. Cosine distance matches OpenAI's recommendation for their embedding
-- models.
create index if not exists spots_embedding_hnsw_idx
  on public.spots using hnsw (embedding vector_cosine_ops);

-- RPC used by /api/search/semantic. Wraps the vector query so the endpoint
-- doesn't need to know pgvector syntax. Returns ids + similarity only; the
-- caller joins against its already-fetched spot list.
create or replace function public.match_spots(
  query_embedding vector(1536),
  match_count int default 8,
  min_similarity float default 0.25
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
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

-- Allow authenticated members to call the RPC (RLS on spots still applies to
-- any subsequent select they do with the returned ids).
grant execute on function public.match_spots(vector, int, float) to authenticated;
