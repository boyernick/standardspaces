-- Expand the rating bucket set from 3 → 5 (Beli's full scale):
-- loved / liked / okay / disliked / hated. Existing rows already use
-- liked / okay / disliked so no data migration is needed — we just widen
-- the CHECK constraint to admit the two new values.

alter table public.spot_ratings
  drop constraint if exists spot_ratings_bucket_check;

alter table public.spot_ratings
  add constraint spot_ratings_bucket_check
  check (bucket in ('loved','liked','okay','disliked','hated'));
