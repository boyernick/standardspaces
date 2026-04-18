-- Itinerary planner v2: add planning criteria to user_itineraries.
--
-- A plan now carries the date it's for, the activities (dinner, drinks,
-- date night…), the vibes (rooftop, intimate…), and the neighborhoods
-- the user wants to stay in. These are filters used at authoring time
-- to surface candidate spaces; they also persist so re-opening a saved
-- plan restores the full context.
--
-- All four columns are defaulted / nullable so v1 rows load cleanly
-- with empty criteria.

alter table public.user_itineraries
  add column if not exists plan_date date,
  add column if not exists activities text[] not null default '{}',
  add column if not exists vibes text[] not null default '{}',
  add column if not exists neighborhoods text[] not null default '{}';

-- No new indexes. We only ever query this table by id (for the owner's
-- own plan) or by user_id (already indexed). The text[] columns are
-- small and read inline with the row.
