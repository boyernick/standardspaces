-- Itinerary invites: co-view a plan with invited members.
--
-- Mirrors the events invite pattern (009_events.sql): a side table holds
-- (itinerary, user, invited_by) tuples. Invitees get read-only access to
-- the plan row and its stops via broadened RLS SELECT policies on
-- user_itineraries and user_itinerary_items. Writes stay owner-only.
--
-- Also adds an `itinerary_id` column to notifications so `plan_invited`
-- rows can join cleanly for feed hydration.

create table if not exists public.itinerary_invites (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.user_itineraries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (itinerary_id, user_id)
);

create index if not exists itinerary_invites_user_id_idx
  on public.itinerary_invites (user_id);

create index if not exists itinerary_invites_itinerary_id_idx
  on public.itinerary_invites (itinerary_id);

alter table public.itinerary_invites enable row level security;

-- Invitee or inviter can read their invite rows.
create policy "Invitee or inviter read plan invites"
  on public.itinerary_invites for select
  using (auth.uid() = user_id or auth.uid() = invited_by);

-- Owner of the plan writes invites; invited_by must equal the caller.
create policy "Owner insert plan invites"
  on public.itinerary_invites for insert
  with check (
    auth.uid() = invited_by
    and exists (
      select 1 from public.user_itineraries i
      where i.id = itinerary_invites.itinerary_id
        and i.user_id = auth.uid()
    )
  );

-- Owner removes anyone's invite; invitee can remove only their own (Leave plan).
create policy "Owner or self delete plan invites"
  on public.itinerary_invites for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.user_itineraries i
      where i.id = itinerary_invites.itinerary_id
        and i.user_id = auth.uid()
    )
  );

-- Broaden user_itineraries SELECT: owner OR invitee.
drop policy if exists "Users can view own itineraries" on public.user_itineraries;
create policy "Owner or invitee read itineraries"
  on public.user_itineraries for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.itinerary_invites inv
      where inv.itinerary_id = user_itineraries.id
        and inv.user_id = auth.uid()
    )
  );

-- Same shape for items — invitees can read the stops.
drop policy if exists "Users can view own itinerary items" on public.user_itinerary_items;
create policy "Owner or invitee read itinerary items"
  on public.user_itinerary_items for select
  using (
    exists (
      select 1 from public.user_itineraries i
      where i.id = user_itinerary_items.itinerary_id
        and (
          i.user_id = auth.uid()
          or exists (
            select 1 from public.itinerary_invites inv
            where inv.itinerary_id = i.id
              and inv.user_id = auth.uid()
          )
        )
    )
  );

-- UPDATE / INSERT / DELETE on user_itineraries and user_itinerary_items stay
-- owner-only — the existing policies from 016_itineraries.sql already enforce that.

-- Context column on notifications so plan_invited rows join cleanly,
-- mirroring the existing event_id column.
alter table public.notifications
  add column if not exists itinerary_id uuid
  references public.user_itineraries(id) on delete cascade;
