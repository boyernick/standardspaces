-- Deduplicate existing check-ins: keep only the most recent per user+spot
DELETE FROM public.user_checkins a
USING public.user_checkins b
WHERE a.user_id = b.user_id
  AND a.spot_id = b.spot_id
  AND a.created_at < b.created_at;

-- Add unique constraint so each user can only check in once per spot
ALTER TABLE public.user_checkins
  ADD CONSTRAINT user_checkins_user_spot_unique UNIQUE (user_id, spot_id);

-- Allow users to delete (uncheck) their own check-ins
CREATE POLICY "Users can delete own checkins"
  ON public.user_checkins FOR DELETE
  USING (auth.uid() = user_id);
