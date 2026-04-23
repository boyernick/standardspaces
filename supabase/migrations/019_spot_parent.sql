-- Nested spaces: a spot that lives inside another spot (e.g. a speakeasy
-- tucked inside a restaurant, a nightclub inside a hotel). Self-referential
-- nullable FK so most rows stay flat; only venues-within-venues set it.
--
-- `spots.id` is text (human-readable slugs like "kaona-room"), not uuid,
-- so the FK column mirrors that type.
--
-- Delete-parent behavior: SET NULL so removing a parent doesn't cascade-
-- delete all the children. The child can then be re-parented or stand on
-- its own, which is the right default when an admin is reorganizing.
ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS parent_spot_id text
    REFERENCES public.spots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS spots_parent_spot_id_idx
  ON public.spots(parent_spot_id)
  WHERE parent_spot_id IS NOT NULL;
