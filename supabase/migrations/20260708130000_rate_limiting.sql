-- Task 2: rate limiting for the two edge functions (extract-medical-data,
-- predict-health-risks), per-user AND per-IP.
--
-- Note on auth endpoints specifically: Supabase Auth (GoTrue) has its own
-- built-in, platform-level rate limiting on /auth/v1/* endpoints
-- (configurable in Dashboard > Auth > Rate Limits), which we don't control
-- from application code since those endpoints aren't ours to instrument.
-- The `login_attempts`-based account lockout added in the RBAC migration is
-- a complementary, per-account application-layer safeguard on top of that -
-- it is not a substitute for platform rate limiting, and SECURITY.md
-- documents both layers explicitly.

CREATE TABLE IF NOT EXISTS public.rate_limits (
  bucket_key TEXT PRIMARY KEY,
  tokens NUMERIC NOT NULL,
  last_refill TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies at all: this table is never read or written directly by
-- clients, only through check_rate_limit() below.
REVOKE ALL ON public.rate_limits FROM authenticated, anon;

-- Classic token bucket: `_max_requests` tokens refill continuously over
-- `_window_seconds`. Returns TRUE (and consumes a token) if the caller is
-- within budget, FALSE if the bucket is empty. The row lock (FOR UPDATE)
-- prevents concurrent requests for the same key from double-spending the
-- same token.
CREATE OR REPLACE FUNCTION public.check_rate_limit(_bucket_key TEXT, _max_requests INT, _window_seconds INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  refill_rate NUMERIC := _max_requests::numeric / _window_seconds::numeric;
  current_tokens NUMERIC;
  elapsed_seconds NUMERIC;
  allowed BOOLEAN;
BEGIN
  INSERT INTO public.rate_limits (bucket_key, tokens, last_refill)
  VALUES (_bucket_key, _max_requests - 1, now())
  ON CONFLICT (bucket_key) DO NOTHING;

  IF FOUND THEN
    RETURN TRUE;
  END IF;

  SELECT tokens, EXTRACT(EPOCH FROM (now() - last_refill))
  INTO current_tokens, elapsed_seconds
  FROM public.rate_limits
  WHERE bucket_key = _bucket_key
  FOR UPDATE;

  current_tokens := LEAST(_max_requests::numeric, current_tokens + elapsed_seconds * refill_rate);

  IF current_tokens >= 1 THEN
    allowed := TRUE;
    current_tokens := current_tokens - 1;
  ELSE
    allowed := FALSE;
  END IF;

  UPDATE public.rate_limits
  SET tokens = current_tokens, last_refill = now()
  WHERE bucket_key = _bucket_key;

  RETURN allowed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT, INT) TO authenticated, anon, service_role;

-- Periodic cleanup is left to a scheduled job (documented in PROJECT_REPORT.md)
-- since pg_cron availability varies by Supabase plan; the table is small
-- (one row per active bucket key) so this is not urgent.
