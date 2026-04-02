-- Add profile fields
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text;

-- User interactions (bookmark, favorite, checkin)
create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  type text not null check (type in ('bookmark', 'favorite', 'checkin')),
  created_at timestamptz default now(),
  unique (user_id, spot_id, type)
);

alter table public.user_interactions enable row level security;

create policy "Users can read own interactions"
  on public.user_interactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own interactions"
  on public.user_interactions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own interactions"
  on public.user_interactions for delete
  using (auth.uid() = user_id);
