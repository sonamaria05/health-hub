-- Task 4: reporting schema, analytics views, and index audit.

-- =====================================================================
-- Missing indexes on FK / RLS-referenced / frequent-WHERE-clause columns.
-- profiles.user_id already has an implicit index (UNIQUE constraint).
-- user_roles.user_id and audit_log(user_id, created_at) were already
-- added in earlier migrations.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_medical_records_user_id ON public.medical_records (user_id);
CREATE INDEX IF NOT EXISTS idx_medical_records_created_at ON public.medical_records (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_user_created ON public.medical_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_training_datasets_user_id ON public.ml_training_datasets (user_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_datasets_record_id ON public.ml_training_datasets (record_id);
CREATE INDEX IF NOT EXISTS idx_ml_training_datasets_created_at ON public.ml_training_datasets (created_at DESC);

-- =====================================================================
-- Extend ml_training_datasets: tag rows with which model version they
-- were captured under, so future retraining audits can tell which
-- artifact generation a given training example was associated with.
-- =====================================================================

ALTER TABLE public.ml_training_datasets
  ADD COLUMN IF NOT EXISTS model_version TEXT;

COMMENT ON COLUMN public.ml_training_datasets.model_version IS
  'Which mlArtifacts model_version (see ml/MODEL_CARD.md) was active when this training example was captured.';

-- =====================================================================
-- model_training_runs: auditable record of every offline training run,
-- populated by the CI retraining workflow (see
-- .github/workflows/retrain-models.yml and scripts/log_training_run.py)
-- using the service role key - never written by end-user clients, same
-- "no client write policy" pattern as audit_log.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.model_training_runs (
  run_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_version TEXT NOT NULL,
  target TEXT NOT NULL, -- 'anemia' | 'diabetes' | 'cardiovascular' | 'kidney'
  metrics_json JSONB NOT NULL,
  dataset_size INTEGER NOT NULL,
  trained_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trained_by TEXT NOT NULL DEFAULT 'ci' -- free-text label (e.g. 'ci', 'manual:<github-username>')
);

CREATE INDEX IF NOT EXISTS idx_model_training_runs_target_trained_at
  ON public.model_training_runs (target, trained_at DESC);

ALTER TABLE public.model_training_runs ENABLE ROW LEVEL SECURITY;

-- Clinicians and admins can review model performance history (this backs
-- the admin dashboard's "model performance over time" view below).
-- Patients have no legitimate reason to see internal training metrics.
DROP POLICY IF EXISTS "Clinicians and admins can view training runs" ON public.model_training_runs;
CREATE POLICY "Clinicians and admins can view training runs" ON public.model_training_runs FOR SELECT
  USING (public.is_clinician_or_admin(auth.uid()));

-- No INSERT/UPDATE/DELETE policy: only the service-role key (used by CI,
-- which bypasses RLS entirely) writes here.
REVOKE INSERT, UPDATE, DELETE ON public.model_training_runs FROM authenticated, anon;

-- =====================================================================
-- Opt-in flag for population-level analytics. Off by default - a user's
-- data is only included in anonymized aggregate stats if they explicitly
-- opt in.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analytics_opt_in BOOLEAN NOT NULL DEFAULT false;

-- =====================================================================
-- Views for AnalyticsPage.
--
-- security_invoker = true (Postgres 15+) makes each view honor the
-- querying user's OWN RLS policies on the underlying tables, rather than
-- the view owner's - this is what makes it safe for user_risk_trends to
-- only ever return the calling user's own data without needing a
-- redundant WHERE user_id = auth.uid() that could be forgotten.
-- =====================================================================

-- Per-user trend of extracted lab metrics over time. RLS on
-- medical_records (via security_invoker) already restricts this to the
-- calling user's own rows, or all rows for a clinician/admin.
CREATE OR REPLACE VIEW public.user_risk_trends
WITH (security_invoker = true) AS
SELECT
  user_id,
  id AS record_id,
  date,
  type,
  status,
  extracted_data,
  created_at
FROM public.medical_records
WHERE date IS NOT NULL
ORDER BY date DESC;

-- Population-level anonymized aggregates, restricted to users who opted
-- in via profiles.analytics_opt_in, with a minimum cohort size (5) per
-- group as a basic k-anonymity safeguard so a small group can't be
-- effectively re-identified from an aggregate (e.g. "the only opted-in
-- patient with condition X this month").
CREATE OR REPLACE VIEW public.population_health_aggregates
WITH (security_invoker = true) AS
SELECT
  mr.type,
  mr.status,
  date_trunc('month', mr.date) AS month,
  count(*) AS record_count
FROM public.medical_records mr
JOIN public.profiles p ON p.user_id = mr.user_id
WHERE p.analytics_opt_in = true
  AND mr.date IS NOT NULL
GROUP BY mr.type, mr.status, date_trunc('month', mr.date)
HAVING count(*) >= 5;

-- No separate RLS needed on population_health_aggregates: it contains no
-- user_id or other direct identifier, and the underlying join only
-- requires SELECT on medical_records/profiles, which every authenticated
-- user already has (scoped to their own rows) - the view's own row set
-- is inherently de-identified and safe to expose broadly. Grant SELECT
-- explicitly since it's a view, not a table with its own RLS policies.
GRANT SELECT ON public.population_health_aggregates TO authenticated;
GRANT SELECT ON public.user_risk_trends TO authenticated;

-- Model performance over time, for the admin/clinician dashboard.
-- Inherits model_training_runs' RLS (clinician/admin only) via
-- security_invoker.
CREATE OR REPLACE VIEW public.model_performance_over_time
WITH (security_invoker = true) AS
SELECT
  target,
  model_version,
  trained_at,
  dataset_size,
  metrics_json ->> 'selected_model' AS selected_model,
  (metrics_json -> 'test_metrics' ->> 'auc')::NUMERIC AS test_auc,
  (metrics_json -> 'test_metrics' ->> 'f1')::NUMERIC AS test_f1,
  (metrics_json -> 'test_metrics' ->> 'brier_score')::NUMERIC AS test_brier_score
FROM public.model_training_runs
ORDER BY target, trained_at DESC;

GRANT SELECT ON public.model_performance_over_time TO authenticated;
