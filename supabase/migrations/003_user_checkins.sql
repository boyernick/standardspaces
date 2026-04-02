create table if not exists public.user_checkins (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  created_at timestamptz default now()
);

alter table public.user_checkins enable row level security;

create policy "Users can view own checkins"
  on public.user_checkins for select
  using (auth.uid() = user_id);

create policy "Users can insert own checkins"
  on public.user_checkins for insert
  with check (auth.uid() = user_id);
