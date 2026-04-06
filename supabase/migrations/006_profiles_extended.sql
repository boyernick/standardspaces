-- Extend profiles with identity, onboarding, and notification preferences

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_notifications boolean NOT NULL DEFAULT true;

-- Make profiles publicly readable by all authenticated users (for public profiles)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Authenticated users can read all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Open activity table SELECT to all authenticated users (for profile stats)
DROP POLICY IF EXISTS "Users can view own checkins" ON public.user_checkins;
CREATE POLICY "Authenticated users can read checkins"
  ON public.user_checkins FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own saves" ON public.user_favorites;
CREATE POLICY "Authenticated users can read favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Authenticated users can read referrals"
  ON public.referrals FOR SELECT
  USING (auth.role() = 'authenticated');

-- Backfill existing members with application data
UPDATE public.profiles p
SET
  first_name = a.first_name,
  last_name = a.last_name,
  instagram = a.instagram,
  onboarded = true
FROM public.applications a
WHERE a.phone = p.phone
  AND a.status = 'approved'
  AND p.first_name IS NULL;
