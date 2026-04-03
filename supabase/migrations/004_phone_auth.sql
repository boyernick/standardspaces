-- Switch from email to phone-based auth

-- Restructure applications table
ALTER TABLE public.applications DROP COLUMN IF EXISTS email;
ALTER TABLE public.applications DROP COLUMN IF EXISTS reason;
ALTER TABLE public.applications DROP COLUMN IF EXISTS referral;
ALTER TABLE public.applications DROP COLUMN IF EXISTS name;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS first_name text NOT NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS last_name text NOT NULL;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS phone text NOT NULL;
ALTER TABLE public.applications ADD CONSTRAINT applications_phone_unique UNIQUE (phone);

-- Update profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- Update admin trigger to use phone
CREATE OR REPLACE FUNCTION public.set_admin_role()
RETURNS trigger AS $$
BEGIN
  IF new.phone = '+15857048027' THEN
    new.role := 'admin';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;
