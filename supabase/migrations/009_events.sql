-- Events feature: events hosted at spaces, with RSVPs, capacity/waitlist, and private invites

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id text NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  city text NOT NULL,
  capacity int,
  price_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  visibility text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (price_cents >= 0),
  CHECK (visibility IN ('public', 'private')),
  CHECK (status IN ('published', 'cancelled', 'hidden'))
);

CREATE INDEX IF NOT EXISTS events_city_starts_at_idx ON public.events (city, starts_at);
CREATE INDEX IF NOT EXISTS events_spot_id_starts_at_idx ON public.events (spot_id, starts_at);
CREATE INDEX IF NOT EXISTS events_host_id_idx ON public.events (host_id);

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going',
  stripe_payment_intent_id text,
  paid_amount_cents int,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id),
  CHECK (status IN ('going', 'waitlist', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_status_idx ON public.event_rsvps (event_id, status);
CREATE INDEX IF NOT EXISTS event_rsvps_user_id_idx ON public.event_rsvps (user_id);

CREATE TABLE IF NOT EXISTS public.event_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_invites_user_id_idx ON public.event_invites (user_id);
CREATE INDEX IF NOT EXISTS event_invites_event_id_idx ON public.event_invites (event_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- events SELECT: public-published OR own OR private-and-invited
CREATE POLICY "View events"
  ON public.events FOR SELECT
  USING (
    (status = 'published' AND visibility = 'public')
    OR host_id = auth.uid()
    OR (
      visibility = 'private'
      AND EXISTS (
        SELECT 1 FROM public.event_invites
        WHERE event_invites.event_id = events.id
          AND event_invites.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Hosts insert own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts update own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts delete own events"
  ON public.events FOR DELETE
  USING (auth.uid() = host_id);

-- event_rsvps: any authenticated can read; users manage their own
CREATE POLICY "Authenticated read rsvps"
  ON public.event_rsvps FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users insert own rsvps"
  ON public.event_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own rsvps"
  ON public.event_rsvps FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own rsvps"
  ON public.event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- event_invites: invitee or host can read; only host can write
CREATE POLICY "Invitee or host read invites"
  ON public.event_invites FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = invited_by);

CREATE POLICY "Host insert invites"
  ON public.event_invites FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_invites.event_id
        AND events.host_id = auth.uid()
    )
  );

CREATE POLICY "Host delete invites"
  ON public.event_invites FOR DELETE
  USING (
    auth.uid() = invited_by
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_invites.event_id
        AND events.host_id = auth.uid()
    )
  );
