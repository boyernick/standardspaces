-- Referral & invite system

-- Referrals table: tracks member-initiated invites and applicant-named referrers
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_name text NOT NULL,
  referred_phone text NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending_apply'
    CHECK (status IN ('pending_apply', 'pending_approval', 'approved', 'denied')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);

CREATE POLICY "Users can create referrals"
  ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_user_id);

CREATE POLICY "Users can update own referrals"
  ON public.referrals FOR UPDATE USING (auth.uid() = referrer_user_id);

-- Add referral columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS referred_by_name text,
  ADD COLUMN IF NOT EXISTS referred_by_phone text,
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_status text DEFAULT NULL
    CHECK (referral_status IS NULL OR referral_status IN ('pending', 'approved', 'denied'));
