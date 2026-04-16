-- Beli-style per-user ratings for spaces.
-- Each user can rate a given spot once (edits re-use the row). The rating is
-- expressed as a bucket (liked / okay / disliked) plus a rank within that
-- bucket (1 = best). The derived `score` on a 1–5 scale is recomputed for the
-- whole bucket whenever a rating is inserted, moved, or deleted.

create table if not exists public.spot_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  bucket text not null check (bucket in ('liked','okay','disliked')),
  score numeric(3,1) not null check (score between 1 and 5),
  bucket_rank integer not null check (bucket_rank >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, spot_id)
);

create index if not exists spot_ratings_user_bucket_rank_idx
  on public.spot_ratings (user_id, bucket, bucket_rank);
create index if not exists spot_ratings_spot_idx
  on public.spot_ratings (spot_id);

alter table public.spot_ratings enable row level security;

create policy "Users manage own ratings"
  on public.spot_ratings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Authenticated can read ratings"
  on public.spot_ratings for select
  to authenticated
  using (true);

-- Aggregate view for the per-space average. SECURITY INVOKER ensures RLS
-- applies to the underlying table when the view is queried.
create or replace view public.spot_rating_aggregates
  with (security_invoker = true) as
  select spot_id,
         round(avg(score)::numeric, 1) as avg_score,
         count(*)::int                  as rating_count
  from public.spot_ratings
  group by spot_id;
