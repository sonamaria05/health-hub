-- Task 5: clinician prediction review/approval workflow.
--
-- Predictions themselves are computed client-side (see src/lib/mlRisk.ts)
-- and are not persisted per-request. This table stores the clinician's
-- REVIEW DECISION about a given patient/condition risk flag (confirm or
-- override), which is what actually needs an audit trail and a queryable
-- "needs review" state for the dashboard - not the underlying prediction
-- itself, which is deterministic and reproducible from the same inputs.
--
-- Reuses log_audit_event() (from the Task 2 audit_log migration) via a
-- trigger, so every review decision is automatically captured in the
-- immutable audit_log too, satisfying "write this to audit_log" without
-- weakening audit_log's own no-client-write invariant or overloading its
-- generic (table_name, row_id) shape with clinical-review-specific fields.

CREATE TABLE IF NOT EXISTS public.prediction_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  original_risk_level TEXT NOT NULL CHECK (original_risk_level IN ('low', 'moderate', 'high')),
  original_probability INTEGER NOT NULL CHECK (original_probability BETWEEN 0 AND 100),
  action TEXT NOT NULL CHECK (action IN ('confirmed', 'overridden')),
  override_risk_level TEXT CHECK (override_risk_level IN ('low', 'moderate', 'high')),
  note TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT override_requires_level CHECK (
    (action = 'overridden' AND override_risk_level IS NOT NULL) OR
    (action = 'confirmed' AND override_risk_level IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_prediction_reviews_patient_condition
  ON public.prediction_reviews (patient_user_id, condition, created_at DESC);

ALTER TABLE public.prediction_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own prediction reviews" ON public.prediction_reviews;
CREATE POLICY "Patients can view own prediction reviews" ON public.prediction_reviews FOR SELECT
  USING (auth.uid() = patient_user_id);

DROP POLICY IF EXISTS "Clinicians and admins can view all prediction reviews" ON public.prediction_reviews;
CREATE POLICY "Clinicians and admins can view all prediction reviews" ON public.prediction_reviews FOR SELECT
  USING (public.is_clinician_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Clinicians and admins can create prediction reviews" ON public.prediction_reviews;
CREATE POLICY "Clinicians and admins can create prediction reviews" ON public.prediction_reviews FOR INSERT
  WITH CHECK (public.is_clinician_or_admin(auth.uid()) AND reviewed_by = auth.uid());

-- Reviews are immutable events (a correction is a new row, not an edit) -
-- no UPDATE/DELETE policy for anyone, same pattern as audit_log itself.
REVOKE UPDATE, DELETE ON public.prediction_reviews FROM authenticated, anon;

DROP TRIGGER IF EXISTS audit_prediction_reviews ON public.prediction_reviews;
CREATE TRIGGER audit_prediction_reviews
  AFTER INSERT ON public.prediction_reviews
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
