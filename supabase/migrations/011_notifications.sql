-- Notifications: unified in-app notification feed

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  spot_id text,
  event_id uuid references public.events(id) on delete cascade,
  recommendation_id uuid references public.recommendations(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create unique index if not exists notifications_user_dedupe_idx
  on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.notifications enable row level security;

create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inserts happen via service-role admin client only; no insert policy.

-- Per-category preferences on profiles. All on by default.
alter table public.profiles
  add column if not exists notification_prefs jsonb
  not null default '{"social":true,"events":true,"recommendations":true,"curation":true}'::jsonb;

-- Attribute future recommendations to the submitter so we can notify them
-- when their spot goes live. Nullable so existing rows and the in-progress
-- RecommendForm flow keep working.
alter table public.recommendations
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists recommendations_user_id_idx on public.recommendations (user_id);
