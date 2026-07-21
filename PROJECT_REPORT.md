# Healytics — Project Report

This is the final deliverable summarizing the production-readiness pass across
all six task areas. It's meant to be read alongside `SECURITY.md` (threat
model) and `ml/MODEL_CARD.md` (full per-model metrics) rather than duplicating
them in full.

## 1. Tech stack

**Frontend**: Vite + React 18 + TypeScript, React Router, TanStack Query,
React Hook Form + Zod, shadcn/ui (Radix primitives) + Tailwind CSS,
`framer-motion` (reduced-motion aware), `recharts`, `lucide-react`,
`next-themes` (dark/light mode).

**Backend**: Supabase — Postgres (RLS-first schema), Auth (email/password +
Google OAuth + TOTP MFA), Storage (private bucket, signed URLs), Edge
Functions (Deno).

**ML**: Python (scikit-learn, XGBoost, SHAP) offline training pipeline →
portable JSON artifacts → hand-verified TypeScript inference engine (no
Python runtime needed at serve time).

**Tests**: Vitest (56 unit/integration tests, including a golden
cross-language fixture verifying the ML JS interpreter against real
sklearn/XGBoost output), Playwright (e2e specs — written and reviewed but
not executable in the environment this was built in; run `npm run e2e`
locally/CI to confirm).

## 2. Full feature list

- Email/password + Google OAuth sign-in, email verification enforcement,
  session-refresh handling, account lockout after repeated failed logins,
  TOTP two-factor authentication, "sign out of all devices."
- Role-based access control (patient / clinician / admin) enforced at the
  database layer via `has_role()`, with matching UI route guards.
- Medical record upload (AI-assisted extraction with a local fallback
  parser), review/edit of extracted lab values, secure storage with
  short-lived signed download URLs.
- Records list with search/filter, skeleton loading states.
- Analytics dashboard: per-metric trends, latest parameters.
- ML-based risk insights for four conditions (anemia, diabetes,
  cardiovascular, kidney) with animated risk gauges, top contributing
  factors, and a non-diagnostic disclaimer.
- Clinician dashboard: patient roster with status filtering, per-patient
  record review, and a confirm/override workflow for ML risk flags.
- Settings: profile, theme toggle, MFA enrollment, "My Activity" audit log,
  reminders, account deletion (with real cascade cleanup).
- Immutable audit logging on every write to `medical_records`,
  `ml_training_datasets`, `profiles`, and `prediction_reviews`.
- Application-layer AES-256-GCM encryption capability for PHI fields
  (additive - see `SECURITY.md` for the exact cutover status).
- Postgres-backed rate limiting and Zod-validated, structured-error edge
  functions.
- Nightly/manual CI retraining workflow that opens a PR with updated
  model metrics for human review.

## 3. Schema summary (ERD in prose)

| Table | Purpose | Key relationships |
|---|---|---|
| `profiles` | Display name, avatar, denormalized role (display only) | `user_id` → `auth.users` |
| `user_roles` | Source of truth for RBAC | `user_id` → `auth.users` |
| `medical_records` | Uploaded reports + extracted lab data | `user_id` → `auth.users` |
| `ml_training_datasets` | Feature/label snapshots per record | `record_id` → `medical_records`, `user_id` → `auth.users` |
| `login_attempts` | Account lockout tracking (by email) | none (email-keyed) |
| `audit_log` | Immutable action log | `user_id` → `auth.users` (`SET NULL` on delete) |
| `rate_limits` | Token-bucket state for edge functions | none (bucket-key keyed) |
| `model_training_runs` | Auditable ML training history | none (append-only) |
| `prediction_reviews` | Clinician confirm/override decisions | `patient_user_id`, `reviewed_by` → `auth.users` |
| Views: `user_risk_trends`, `population_health_aggregates`, `model_performance_over_time` | Read-only projections for Analytics/admin, RLS-inherited via `security_invoker` | — |

Full column-level detail lives in `supabase/migrations/*.sql` (one file per
change, never edited after the fact).

## 4. RLS policy table

*(All tables have RLS **enabled**; anything not listed for an operation is
**denied by default** — there is no `USING (true)` anywhere in this schema.)*

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Own row, or any row if clinician/admin | Own row only | Own row only | *(none — denied)* |
| `user_roles` | Own row, or all if admin | Admin only | Admin only | Admin only |
| `medical_records` | Own rows, or all if clinician/admin | Own rows only | Own rows only | Own rows only |
| `ml_training_datasets` | Own rows, or all if clinician/admin | Own rows only | Own rows only | Own rows only |
| `login_attempts` | Admin only (direct); anyone via `is_account_locked()`/`record_login_attempt()` | *(none — SECURITY DEFINER functions only)* | *(none)* | *(none)* |
| `audit_log` | Own rows, or all if admin | *(none — trigger-only, `log_audit_event()`)* | *(none)* | *(none)* |
| `rate_limits` | *(none — direct access revoked)* | *(none — `check_rate_limit()` only)* | *(none)* | *(none)* |
| `model_training_runs` | Clinician/admin only | *(none — CI service-role key only)* | *(none)* | *(none)* |
| `prediction_reviews` | Own rows (patient), or all if clinician/admin | Clinician/admin only, must set `reviewed_by = auth.uid()` | *(none — immutable)* | *(none)* |
| `storage.objects` (`medical-reports` bucket) | Own folder, or all if clinician/admin | Own folder only | Own folder only | Own folder only |

## 5. Model card summary

Full detail (per-target confusion matrix, precision/recall, calibration
diagnostics, SHAP ranking, known limitations) is in `ml/MODEL_CARD.md`,
regenerated automatically on every training run. Headline numbers from the
current run:

| Condition | Selected model | Test AUC | Test F1 | Test Brier (calibrated) |
|---|---|---|---|---|
| Anemia | XGBoost | 0.889 | 0.813 | 0.131 |
| Diabetes | XGBoost | 0.975 | 0.863 | 0.058 |
| Cardiovascular | XGBoost | 0.966 | 0.957 | 0.059 |
| Kidney | XGBoost | 0.953 | 0.873 | 0.100 |

**Read this with the dataset size in mind** (~100 real patients before
augmentation — see `ml/validated_dataset_sources.md`). These are not
clinically validated metrics. The in-product disclaimer and
`ml/MODEL_CARD.md`'s "Known limitations" section both say this explicitly.

## 6. Environment variables & secrets

**Frontend `.env`** (see `.env.example`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — required
- `VITE_ENABLE_DEMO_DATA` — optional, defaults to `false`

**Supabase project secrets** (edge functions — set via `supabase secrets set`):
- `LOVABLE_API_KEY` — AI extraction gateway
- `PHI_ENCRYPTION_KEY` — 32-byte base64 key for AES-256-GCM PHI encryption
- `ALLOWED_ORIGIN` — CORS lock-down for edge functions
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by the platform, no manual setup needed

**GitHub Actions repo secrets** (optional, for the retraining workflow's
audit-log step only — the workflow itself doesn't require these to run):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Dev-only** (never used by the deployed app): `SEED_ALLOW_REMOTE` for
`scripts/seed_dev_data.ts`'s production-safety guard.

## 7. Local run steps (VS Code)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY

# 3. Start a local Supabase instance (requires the Supabase CLI)
supabase start
# Note the local API URL and keys from the output (or `supabase status`)

# 4. Apply all migrations to the local instance
supabase db reset

# 5. (Optional) Seed realistic fake data for local development
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local service role key> \
npm run seed:dev

# 6. (Optional) Retrain the ML models — requires Python 3.12+
pip install -r requirements.txt
npm run ml:train

# 7. Run the app
npm run dev

# 8. Quality gates
npm run lint
npm run test
npm run build
npm run e2e   # requires `npx playwright install` first
```

**Deploying edge functions** (once pointed at a real Supabase project):

```bash
supabase secrets set LOVABLE_API_KEY=... PHI_ENCRYPTION_KEY=... ALLOWED_ORIGIN=...
supabase functions deploy extract-medical-data predict-health-risks delete-account
```

## 8. Known limitations (project-wide, honest summary)

- **Migrations are syntax-verified, not execution-verified against a live
  Supabase instance** — this was built without access to a running
  Supabase project or browser. Run `supabase db reset` before trusting this
  in any real environment.
- **Playwright e2e specs are written and reviewed but not run** in this
  environment — run `npm run e2e` locally/CI to confirm.
- **PHI encryption is additive, not yet the sole source of truth** — see
  `SECURITY.md` for the exact reasoning and what a full cutover would
  require.
- **Dataset is demo-scale** (~100 real patients) — see `ml/MODEL_CARD.md`
  and `ml/validated_dataset_sources.md` for the full caveat.
- Genuine regulatory compliance (HIPAA, GDPR, etc.) requires a signed
  Business Associate Agreement, formal risk assessment, and legal review —
  see the verbatim caveat in `SECURITY.md`.
