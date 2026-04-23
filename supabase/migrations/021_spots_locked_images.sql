-- Mirror of recommendations.locked_images on spots so the admin edit-
-- listing form can persist the same "pin through re-scrape / preserve
-- through bulk operations" signal on live listings. Spots don't have a
-- rescrape endpoint today, but the intent is carried forward if/when
-- one lands, and downstream ops (curation passes, photo repopulation)
-- can honor it.
ALTER TABLE public.spots
  ADD COLUMN IF NOT EXISTS locked_images text[] NOT NULL DEFAULT '{}';
