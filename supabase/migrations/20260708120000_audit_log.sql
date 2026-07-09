-- Task 2: immutable audit log.
-- No INSERT/UPDATE/DELETE policy is defined for audit_log at all, so no
-- client (not even an admin) can write or alter it directly through the
-- API. The only writer is log_audit_event(), a SECURITY DEFINER trigger
-- function that - because it's owned by the table owner - bypasses RLS
-- the same way any table owner naturally does, which is the standard
-- Supabase/Postgres pattern for "trusted server-side writer, no client
-- writer" tables.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  row_id UUID,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON public.audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row ON public.audit_log (table_name, row_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own activity" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can view all activity" ON public.audit_log;

CREATE POLICY "Users can view own activity" ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Intentionally no INSERT / UPDATE / DELETE policies: default-deny means no
-- client can write here at all, not even an admin. REVOKE below is
-- belt-and-suspenders in case a future migration ever grants broad table
-- privileges to authenticated/anon.
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_headers JSON;
  client_ip TEXT;
  client_ua TEXT;
BEGIN
  -- PostgREST (which Supabase's data API runs on) exposes request headers
  -- as a session-local GUC. This is only populated for requests that came
  -- in through the API; direct psql/migration-driven writes will simply
  -- log a NULL ip/user_agent, which is expected and fine.
  BEGIN
    request_headers := current_setting('request.headers', true)::json;
    client_ip := request_headers->>'x-forwarded-for';
    client_ua := request_headers->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    client_ip := NULL;
    client_ua := NULL;
  END;

  INSERT INTO public.audit_log (user_id, action, table_name, row_id, ip, user_agent)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    client_ip,
    client_ua
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_medical_records ON public.medical_records;
CREATE TRIGGER audit_medical_records
  AFTER INSERT OR UPDATE OR DELETE ON public.medical_records
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_ml_training_datasets ON public.ml_training_datasets;
CREATE TRIGGER audit_ml_training_datasets
  AFTER INSERT OR UPDATE OR DELETE ON public.ml_training_datasets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
