-- Locked photos: URLs an admin has pinned so a subsequent re-scrape
-- merges them back into scraped_images rather than overwriting them
-- with whatever Google Places / HTML scrape returns this round.
--
-- Stored on `recommendations` only — `spots` isn't re-scraped once
-- published, so the concept doesn't apply there.
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS locked_images text[] NOT NULL DEFAULT '{}';
