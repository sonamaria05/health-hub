# Security

Healytics handles medical records - a sensitive data category by any
regulatory definition. This document describes the threat model, what's
covered, what isn't, and how to report a problem.

> **This implementation follows security best practices for handling
> sensitive health data, but genuine regulatory compliance (HIPAA, GDPR,
> etc.) requires a signed Business Associate Agreement with
> Supabase/your hosting provider, a formal risk assessment, and legal
> review - code changes alone do not make a platform "HIPAA compliant."**

## Threat model

**In scope / actively defended against:**
- An unauthenticated attacker attempting to read, modify, or delete another
  user's medical records, ML data, or profile.
- An authenticated attacker attempting to read/modify data belonging to a
  different user (horizontal privilege escalation), including via a
  compromised or forged client-supplied role claim.
- A patient-role user attempting to reach clinician/admin-only
  functionality (vertical privilege escalation).
- Credential-stuffing / password-guessing against a single account.
- A raw database dump or backup exposing plaintext free-text PHI fields.
- Abuse of the two AI-backed edge functions to run up cost or degrade
  service for other users (rate limiting).
- A stolen/leaked long-lived file URL granting indefinite access to a
  medical report.
- Tampering with the audit trail (by anyone, including admins).
- Common web response-header-level attacks (clickjacking, MIME sniffing,
  protocol downgrade) via CSP/HSTS/X-Frame-Options/etc.

**Explicitly out of scope / not defended against by this codebase alone:**
- A compromised Supabase project (leaked service role key, compromised
  Supabase infrastructure). The service role key must be treated as a full
  admin credential and never exposed to the client or committed to source
  control.
- Physical/device-level compromise of a user's own logged-in browser
  session.
- Supabase Auth's own infrastructure-level rate limiting and abuse
  detection on `/auth/v1/*` endpoints - that's a platform capability
  (Dashboard > Auth > Rate Limits), not something this codebase
  instruments. The `login_attempts`-based account lockout here is a
  complementary, per-account application-layer safeguard on top of it, not
  a replacement.
- Formal regulatory compliance - see the caveat above.
- Availability/DDoS at the network layer (Supabase/hosting provider's
  responsibility).

## Architecture

- **Authentication**: Supabase Auth (email/password + Google OAuth), with
  email verification enforced before protected routes are reachable,
  optional TOTP MFA, and per-account lockout after repeated failed logins.
- **Authorization**: role-based (`patient`/`clinician`/`admin`), stored in
  `user_roles` (never trusted from the client) and checked via the
  `has_role()` SECURITY DEFINER Postgres function. `profiles.role` is a
  denormalized *display-only* copy, kept in sync by a trigger, and is never
  read by an RLS policy or authorization check.
- **Row Level Security**: every table has RLS enabled with default-deny; no
  policy uses `USING (true)`. See PROJECT_REPORT.md for the full policy
  table.
- **Audit logging**: `audit_log` is written only by a SECURITY DEFINER
  trigger function (`log_audit_event()`) on `medical_records`,
  `ml_training_datasets`, and `profiles`. No client - not even an admin -
  has an INSERT/UPDATE/DELETE policy on this table, making it effectively
  immutable through the API.
- **PHI encryption at the application layer**: AES-256-GCM
  (`supabase/functions/_shared/crypto.ts`), on top of Supabase's at-rest
  encryption, so a raw database dump of `notes`/`extracted_data` isn't
  plaintext. **Current status**: the encryption primitive is implemented
  and unit-tested (round-trip, wrong-key rejection, and tamper-detection
  via the GCM auth tag all covered), and is wired into
  `extract-medical-data` to populate new `notes_encrypted`/
  `extracted_data_encrypted` columns additively. Cutting every existing
  read path (`RecordsContext`, `DashboardPage`, `AnalyticsPage`,
  `PredictionsPage`) over to decrypt-on-read and retiring the plaintext
  columns is tracked as a follow-up rather than shipped unverified against
  a live database - see the migration header comment in
  `20260708140000_phi_encrypted_columns.sql` for the specific reasoning.
  Until that cutover happens, `notes`/`extracted_data` remain plaintext in
  the database, same as before this change.
- **Rate limiting**: a Postgres-backed token bucket (`check_rate_limit()`),
  applied per-user and per-IP to both edge functions.
- **File access**: the storage bucket is private; downloads/previews go
  through short-TTL (5 minute) signed URLs, never long-lived public URLs.
- **Edge functions**: every function validates its input with Zod, requires
  a verified Supabase session, is rate-limited, and returns structured JSON
  errors with correct status codes. 500 responses never include the raw
  exception message or a stack trace - only a generic message, with the
  real error logged server-side for debugging.
- **Transport/browser security headers**: CSP, X-Frame-Options, HSTS,
  Referrer-Policy, X-Content-Type-Options, and a restrictive
  Permissions-Policy are set via `public/_headers` (Netlify/Cloudflare
  Pages) and `vercel.json` (Vercel), with matching headers on the Vite dev
  server for local parity. **If you deploy to a host that doesn't read
  either of those files** (plain nginx, S3+CloudFront, etc.), you must
  configure the equivalent headers at that layer yourself - they will not
  apply automatically.
- **Account deletion**: `delete-account` edge function, guarded by a
  type-to-confirm UI, deletes the `auth.users` row via the Admin API (which
  cascades to `profiles`/`medical_records`/`ml_training_datasets`/
  `user_roles` via `ON DELETE CASCADE`), plus best-effort cleanup of
  storage files and `login_attempts` rows, which aren't foreign-key linked.
  `audit_log` rows are intentionally preserved with `user_id` set to
  `NULL` - the audit trail's own integrity outlives the account it
  describes.

## Known limitations / honest caveats

- The migrations in this repo have been syntax-checked against a real
  Postgres grammar parser but **not executed against a live database** as
  part of this work - there was no live Supabase project available in the
  environment this was built in. Run `supabase db reset` (or apply to a
  dev project) and confirm before trusting this in production.
- The Playwright e2e suite (including the RBAC and MFA specs) was written
  but not executed for the same reason (no browser runtime available).
  Run `npm run e2e` locally/CI before relying on it as a merge gate.
- The migration that bootstraps the first-ever signed-up user to `admin`
  is a development convenience so there's always at least one admin
  account; review it before running against a database with real users.

## Reporting a vulnerability

If you find a security issue, please do not open a public GitHub issue.
Email the maintainers directly (add a real contact address here before
deploying this to production) with:
- A description of the issue and its potential impact.
- Steps to reproduce.
- Any relevant logs or screenshots (with PHI redacted).

We'll acknowledge reports and aim to have a fix or mitigation plan within a
reasonable timeframe based on severity.
