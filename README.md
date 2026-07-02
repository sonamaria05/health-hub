# Healytics

Healytics is a Vite + React + Supabase app for managing personal medical records, extracting data from uploaded reports, tracking health analytics, and generating model-based health insights.

## What This Version Supports

- Email/password and Google sign-in with profile syncing
- Email verification reminders and password reset flow
- Private medical report uploads stored in Supabase storage
- AI-assisted extraction with manual review before saving
- Editable records with patient name, summary, notes, and processing status
- Analytics and health insights generated from real uploaded data
- Tabular ML training pipeline with engineered features, candidate-model comparison, threshold tuning, and evaluation metrics
- Validated-dataset preparation path for replacing the demo CSV with clinical research data
- User-scoped row-level security for records, ML datasets, profiles, and storage objects

## Local Setup

1. Install dependencies
   - `npm install`
2. Create a `.env` file with:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_PUBLISHABLE_KEY=...`
3. Run the app
   - `npm run dev`
4. Train or refresh the ML artifacts
   - `npm run ml:train`
5. Normalize a validated external dataset into the project schema when you are ready
   - `npm run ml:prepare-validated -- --input path/to/source.csv --output ml/validated_dataset.csv`

## Supabase Setup

1. Apply the migrations in `supabase/migrations`
2. Deploy the edge functions in `supabase/functions/extract-medical-data` and `supabase/functions/predict-health-risks`
3. Configure these secrets for the edge function:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `LOVABLE_API_KEY`
4. Keep email verification enabled in Supabase Auth settings

## Important Notes

- Report files are expected to be stored under `<user-id>/...` paths in the `medical-reports` bucket.
- The newest migration makes the bucket private and removes old permissive storage policies.
- Model artifacts are generated into `ml/model_artifacts.json`, `ml/model_metrics.json`, and `src/lib/generated/mlArtifacts.ts`.
- The trainer compares logistic regression and random forest candidates per health target using cross-validation, then exports the best deployable artifact for each target.
- The predictions page uses the backend model when available and falls back to the local generated artifacts if the edge function is unavailable.
- See `ml/validated_dataset_sources.md` for the recommended path to move from demo data to a validated medical dataset.

## Suggested Next Steps

- Add end-to-end tests once dependencies are installed
- Add a clinician review workflow or approval state
- Improve OCR and structured extraction quality in the edge function
- Add export/download features for record summaries
