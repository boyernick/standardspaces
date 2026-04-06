-- Follow system: members can follow each other

CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view follows"
  ON public.user_follows FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own follows"
  ON public.user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);
