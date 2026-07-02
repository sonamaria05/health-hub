-- Harden storage access and extend the medical_records schema for richer app workflows.

ALTER TABLE public.medical_records
  ADD COLUMN IF NOT EXISTS patient_name TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'processed'
    CHECK (processing_status IN ('pending', 'processed', 'needs_review', 'failed')),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;

UPDATE public.medical_records
SET processing_status = 'processed'
WHERE processing_status IS NULL;

DROP POLICY IF EXISTS "Anyone can upload medical reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view medical reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete medical reports" ON storage.objects;

UPDATE storage.buckets
SET public = false
WHERE id = 'medical-reports';

DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

CREATE POLICY "Users can upload own files" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own files" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'medical-reports'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view own ml data" ON public.ml_training_datasets;
DROP POLICY IF EXISTS "Users can insert own ml data" ON public.ml_training_datasets;

CREATE POLICY "Users can view own ml data" ON public.ml_training_datasets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ml data" ON public.ml_training_datasets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ml data" ON public.ml_training_datasets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ml data" ON public.ml_training_datasets FOR DELETE
  USING (auth.uid() = user_id);
