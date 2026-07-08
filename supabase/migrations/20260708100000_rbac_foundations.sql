-- Task 1: RBAC foundations.
-- Roles are NEVER trusted from the client. Source of truth is `user_roles`,
-- checked exclusively through the SECURITY DEFINER `has_role()` function so
-- RLS policies never need to (and never should) read a client-writable column
-- to make an authorization decision.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('patient', 'clinician', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER: safe to call from RLS policies without recursive RLS
-- evaluation on user_roles itself, and without ever trusting a role value
-- supplied by the client.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Convenience for "clinician or admin" checks used throughout the app.
CREATE OR REPLACE FUNCTION public.is_clinician_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'clinician') OR public.has_role(_user_id, 'admin');
$$;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Denormalized display copy on profiles ONLY. Never used for authorization
-- decisions - always kept in sync from user_roles, never written directly
-- by clients (no client-facing UPDATE policy touches this column path;
-- the only writer is the trigger below).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'patient';

CREATE OR REPLACE FUNCTION public.sync_profile_role_display()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  highest_role public.app_role;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);

  SELECT role INTO highest_role
  FROM public.user_roles
  WHERE user_id = target_user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'clinician' THEN 2
    WHEN 'patient' THEN 3
  END
  LIMIT 1;

  UPDATE public.profiles
  SET role = COALESCE(highest_role, 'patient')
  WHERE user_id = target_user_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_user_roles_changed ON public.user_roles;
CREATE TRIGGER on_user_roles_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_display();

-- Assign the default 'patient' role on signup. This replaces reliance on
-- any role value a client might submit during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'patient')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =====================================================================
-- Fix a pre-existing RLS gap: policies allowed any row with a NULL
-- user_id to be read by every authenticated user ("OR user_id IS NULL").
-- That was meant for legacy/demo rows but is a real cross-user data leak
-- vector, so it's removed as part of rewriting these policies for roles.
-- =====================================================================

DROP POLICY IF EXISTS "Users can view own records" ON public.medical_records;
DROP POLICY IF EXISTS "Users can insert own records" ON public.medical_records;
DROP POLICY IF EXISTS "Users can update own records" ON public.medical_records;
DROP POLICY IF EXISTS "Users can delete own records" ON public.medical_records;
DROP POLICY IF EXISTS "Clinicians and admins can view all records" ON public.medical_records;

CREATE POLICY "Users can view own records" ON public.medical_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clinicians and admins can view all records" ON public.medical_records FOR SELECT
  USING (public.is_clinician_or_admin(auth.uid()));

CREATE POLICY "Users can insert own records" ON public.medical_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own records" ON public.medical_records FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own records" ON public.medical_records FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own ml data" ON public.ml_training_datasets;
DROP POLICY IF EXISTS "Users can insert own ml data" ON public.ml_training_datasets;
DROP POLICY IF EXISTS "Users can update own ml data" ON public.ml_training_datasets;
DROP POLICY IF EXISTS "Users can delete own ml data" ON public.ml_training_datasets;
DROP POLICY IF EXISTS "Clinicians and admins can view all ml data" ON public.ml_training_datasets;

CREATE POLICY "Users can view own ml data" ON public.ml_training_datasets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clinicians and admins can view all ml data" ON public.ml_training_datasets FOR SELECT
  USING (public.is_clinician_or_admin(auth.uid()));

CREATE POLICY "Users can insert own ml data" ON public.ml_training_datasets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ml data" ON public.ml_training_datasets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ml data" ON public.ml_training_datasets FOR DELETE
  USING (auth.uid() = user_id);

-- Storage: fix same NULL-bypass pattern for medical-reports.
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-reports'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_clinician_or_admin(auth.uid())
    )
  );

-- =====================================================================
-- Login attempt tracking for account lockout.
-- Keyed by normalized email (not solely by IP, since IP is client-context
-- and not reliably available inside a client-invoked RPC). This protects
-- a given account from repeated password-guessing regardless of source IP.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON public.login_attempts (lower(email), created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Default deny for direct table access; all reads/writes go through the
-- SECURITY DEFINER functions below. Admins may audit directly.
DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts" ON public.login_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.record_login_attempt(_email TEXT, _success BOOLEAN, _user_agent TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, success, user_agent)
  VALUES (lower(trim(_email)), _success, _user_agent);

  -- Prevent unbounded growth: keep 90 days of history.
  DELETE FROM public.login_attempts
  WHERE lower(email) = lower(trim(_email)) AND created_at < now() - interval '90 days';
END;
$$;

-- Lockout policy: 5 failed attempts within 15 minutes, with no successful
-- attempt after the first of those failures, locks the account for 15 minutes.
CREATE OR REPLACE FUNCTION public.is_account_locked(_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failures INT;
  last_success TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT max(created_at) INTO last_success
  FROM public.login_attempts
  WHERE lower(email) = lower(trim(_email)) AND success = TRUE
    AND created_at > now() - interval '15 minutes';

  SELECT count(*) INTO recent_failures
  FROM public.login_attempts
  WHERE lower(email) = lower(trim(_email)) AND success = FALSE
    AND created_at > now() - interval '15 minutes'
    AND (last_success IS NULL OR created_at > last_success);

  RETURN recent_failures >= 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinician_or_admin(UUID) TO authenticated;

-- Backfill: give the very first signed-up user (if any exist) the admin
-- role so there's always at least one account able to manage roles.
-- Safe to re-run: no-ops if a role already exists for that user.
DO $$
DECLARE
  first_user_id UUID;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (first_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
