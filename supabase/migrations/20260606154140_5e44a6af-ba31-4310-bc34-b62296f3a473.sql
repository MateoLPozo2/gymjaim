
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS role text NULL,
  ADD COLUMN IF NOT EXISTS role_custom text NULL,
  ADD COLUMN IF NOT EXISTS goals text NULL,
  ADD COLUMN IF NOT EXISTS preferred_topics text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS welcome_on_next_login boolean NOT NULL DEFAULT false;
