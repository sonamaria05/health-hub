-- Task 2: application-layer encryption for sensitive free-text fields.
--
-- These are ADDITIVE columns, not a replacement for `notes`/`extracted_data`
-- yet. supabase/functions/extract-medical-data populates them (AES-256-GCM,
-- see supabase/functions/_shared/crypto.ts) when PHI_ENCRYPTION_KEY is
-- configured. Cutting the app over to read/write exclusively through these
-- encrypted columns requires updating every place that currently reads
-- `notes`/`extracted_data` directly (RecordsContext, DashboardPage,
-- AnalyticsPage, PredictionsPage) to decrypt server-side instead - that's
-- tracked as a follow-up rather than shipped here unverified against a live
-- database. See SECURITY.md for the full explanation of this tradeoff.

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS notes_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS extracted_data_encrypted TEXT;

COMMENT ON COLUMN public.medical_records.notes_encrypted IS
  'AES-256-GCM ciphertext (base64) of the notes/summary field. See supabase/functions/_shared/crypto.ts. Not yet the authoritative source - see migration header.';
COMMENT ON COLUMN public.medical_records.extracted_data_encrypted IS
  'AES-256-GCM ciphertext (base64) of the extracted_data field. See supabase/functions/_shared/crypto.ts. Not yet the authoritative source - see migration header.';
