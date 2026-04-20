-- Itineraries: ordered, named plans of 1-8 spots for a given city.
--
-- `user_itineraries` is the parent row (auth'd user + name + city). Each
-- plan is scoped to a single city in v1; cross-city plans aren't supported.
--
-- `user_itinerary_items` holds the ordered stops. Order is encoded in an
-- explicit `position` int (0..N-1). spot_id is a text slug that matches
-- the app's in-memory Spot.id — we intentionally don't foreign-key to
-- public.spots since that table is managed separately by the scrape
-- pipeline and we don't want a cascade to wipe a user's plan if a spot
-- is rekeyed. Orphan rows are tolerated; the reader filters them out.
--
-- RLS is owner-only on both tables, mirroring user_saves and user_checkins.

create table if not exists public.user_itineraries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  city text not null,
  name text not null default 'Untitled plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_itineraries_user_id_idx
  on public.user_itineraries (user_id, updated_at desc);

create index if not exists user_itineraries_user_city_idx
  on public.user_itineraries (user_id, city);

create table if not exists public.user_itinerary_items (
  itinerary_id uuid not null references public.user_itineraries(id) on delete cascade,
  spot_id text not null,
  position int not null,
  time_label text,
  primary key (itinerary_id, position),
  check (position >= 0 and position < 8),
  check (time_label is null or char_length(time_label) <= 16)
);

create index if not exists user_itinerary_items_spot_id_idx
  on public.user_itinerary_items (spot_id);

alter table public.user_itineraries enable row level security;
alter table public.user_itinerary_items enable row level security;

-- user_itineraries: owner-only
create policy "Users can view own itineraries"
  on public.user_itineraries for select
  using (auth.uid() = user_id);

create policy "Users can insert own itineraries"
  on public.user_itineraries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own itineraries"
  on public.user_itineraries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own itineraries"
  on public.user_itineraries for delete
  using (auth.uid() = user_id);

-- user_itinerary_items: gated by the parent itinerary's ownership
create policy "Users can view own itinerary items"
  on public.user_itinerary_items for select
  using (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Users can insert own itinerary items"
  on public.user_itinerary_items for insert
  with check (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Users can update own itinerary items"
  on public.user_itinerary_items for update
  using (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and i.user_id = auth.uid()
    )
  );

create policy "Users can delete own itinerary items"
  on public.user_itinerary_items for delete
  using (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and i.user_id = auth.uid()
    )
  );
