create table if not exists public.user_saves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id text not null,
  created_at timestamptz default now(),
  unique(user_id, spot_id)
);

alter table public.user_saves enable row level security;

create policy "Users can view own saves"
  on public.user_saves for select
  using (auth.uid() = user_id);

create policy "Users can insert own saves"
  on public.user_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saves"
  on public.user_saves for delete
  using (auth.uid() = user_id);
