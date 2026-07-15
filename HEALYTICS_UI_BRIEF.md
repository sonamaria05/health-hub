# Healytics — UI Design Brief

## 1. What this product is

Healytics is a personal medical-records and health-risk-insight web app. A
patient uploads lab reports (PDF/image/etc.), the app extracts structured
lab values from them, and the app shows the patient trends over time and
ML-based risk estimates for four conditions (anemia, diabetes,
cardiovascular disease, kidney function). A separate clinician role can
review patients' records and confirm or override the ML risk flags.

**This is a demo/learning project, not a real medical product.** Every
screen that shows a risk score must visually communicate "this is not a
diagnosis" — that matters for the design, not just the copy.

**Tone**: calm, clinical-but-warm, trustworthy. Not clinical-cold
(hospital beige), not consumer-flashy (wellness-app pastel). Think "a
well-designed insurance or fintech dashboard," not "a hospital intranet."

---

## 2. Who uses it — three roles

| Role | Can do |
|---|---|
| **Patient** (default role on signup) | Upload reports, view own records, view own analytics/trends, view own risk predictions, manage own account/security settings |
| **Clinician** | Everything a patient can do for their *own* account, plus: view a list of all patients, open any patient's records, confirm or override an ML risk prediction |
| **Admin** | Everything a clinician can do, plus implicit access to manage roles (no dedicated UI planned yet — out of scope for this design pass) |

A user only ever has one primary experience at a time — the sidebar
navigation differs for patient vs. clinician (clinician gets an extra
"Clinician" nav item; there's no role switcher UI).

---

## 3. Full page inventory

### 3.1 Auth page (`/auth`)
Single page, three modes toggled by tabs/links: **Sign in**, **Sign up**,
**Forgot password**. Also supports:
- Google OAuth as an alternate sign-in method (needs its own button)
- A post-password-submit **MFA challenge step** (6-digit code input) that
  replaces the form when a user has 2FA enabled — this should feel like a
  clean transition, not a jarring page swap
- Inline error state for account lockout ("too many failed attempts")

### 3.2 Patient Dashboard (`/`) — the default landing page
Purpose: "here's my health at a glance, right now."
- Greeting header ("Welcome back, {name}")
- 2–3 stat cards: total records, records needing review/attention, days
  since last checkup
- Recent records list (last 3–5), each showing type icon, title, date,
  status badge (normal / attention / critical / processing)
- A reminders widget (upcoming follow-ups/medication reminders, can be
  empty)
- Empty state matters a lot here: a brand-new user has zero records —
  design a genuinely inviting empty state, not just "no data."

### 3.3 Upload (`/upload`)
Purpose: get a report into the system.
- Drag-and-drop file zone (accepts PDF, PNG, JPG, WEBP, TXT, CSV, JSON,
  DOC, DOCX, up to 20MB) with a clear "files are stored securely,
  scoped to your account" trust message
- Processing state while the file is extracted (this can take a few
  seconds — needs a real loading state, not just a spinner; consider a
  short "reading your report…" progress feel)
- Review-extracted-data step: shows each detected lab value (name, value,
  unit, normal range, status: normal/high/low) in an editable list before
  the user confirms and saves
- Success confirmation state

### 3.4 Records (`/records`)
Purpose: browse and manage everything uploaded so far.
- Search/filter bar (by type, status, date)
- List/grid of record cards: type icon, title, date, doctor, hospital,
  status badge
- Click into a record for full detail (extracted values, notes, original
  file viewer/download)
- Edit and delete actions per record
- A record can be in a "processing" state (not yet extracted) — needs a
  skeleton/placeholder treatment, not a blank space

### 3.5 Analytics (`/analytics`)
Purpose: "how are my numbers trending over time."
- Summary cards for key metrics (e.g. hemoglobin, glucose, cholesterol)
  with current value + trend direction
- A trend-over-time line/area chart (multiple lab values, selectable)
- A "latest extracted parameters" breakdown list
- This page is currently backed by simple per-user trend data; treat it
  as a straightforward analytics dashboard, not a diagnostic tool

### 3.6 Insights / Predictions (`/predictions`)
Purpose: show the ML risk output.
- A short "how this works" explainer card (plain language: this estimates
  statistical risk from your lab patterns, it is not a diagnosis)
- Model-quality summary (accuracy/F1/AUC as small stat chips — this is
  meta-info about the model, secondary to the per-condition cards)
- One card per condition (anemia, diabetes, cardiovascular, kidney),
  each showing:
  - Risk level (low / moderate / high) — needs a strong, glanceable
    visual (a gauge/ring/bar, not just a colored word)
  - Numeric probability
  - Top 2–3 contributing factors (e.g. "HbA1c elevated")
  - A short plain-language recommendation
- This page carries the most "must not look like a diagnosis" weight in
  the whole app — the visual design of the risk indicator matters a lot.

### 3.7 Clinician Dashboard (`/clinician`) — clinician/admin only
Purpose: review patients, not just self.
- Patient list (name/initials avatar, quick status: "needs review" /
  "confirmed" / "stable")
- Click into a patient to see their records (same detail view as 3.4,
  read-only for demographic edits)
- A prediction review/approval workflow: for each ML risk flag, the
  clinician can **confirm** or **override** it, with the action logged
- Non-clinician users are blocked from this route entirely with a clear
  "access denied" screen, not a silent redirect.

### 3.8 Settings (`/settings`)
Purpose: account, security, preferences — a few visually distinct
sections on one page (or tabbed, either works):
- **Profile**: display name, avatar
- **Security**: email verification status, two-factor auth
  enrollment (QR code + code entry flow), "sign out of all devices"
  button, a read-only "My Activity" audit log list
- **Appearance**: light/dark theme toggle
- **Reminders**: simple list + add-reminder form
- **Danger zone**: "Delete my account and all data" — must require
  typing a confirmation phrase, and should look deliberately more
  serious/isolated than the rest of the page (this is irreversible)

### 3.9 Error/utility states
- 403 "Access denied" (shown when a patient tries to hit `/clinician`)
- 404 not found
- Email-verification-required blocking screen (shown app-wide until a
  new signup verifies their email)

---

## 4. Interaction states every data page needs

Every page in 3.2–3.7 needs **all four** of these states designed, not
just the happy path:
1. **Loading** — skeleton placeholders shaped like the real content, not
   a centered spinner
2. **Empty** — first-time-user state, inviting rather than apologetic
3. **Error** — something failed (network, server) — needs a retry action
4. **Populated** — the normal case

---

## 5. Brand mood (guidance only — not prescriptive)

There's no fixed visual identity to match. Some loose mood guidance:

- Calm, clinical-but-warm, trustworthy — not hospital-cold, not
  consumer-wellness-pastel. Closer to "a well-designed fintech or
  insurance dashboard" than "a hospital intranet."
- A cool, natural color feel (teal/blue-leaning) reads well for a health
  app, but this is a suggestion, not a requirement — use your own
  judgment on palette, typography, iconography, and component style.
- Whatever palette is chosen needs a genuine dark mode, not just an
  inverted one.

**No stock photos of people/faces anywhere in the UI.** This is a
health app handling sensitive personal data — generic stock photography
of "smiling doctor" or "happy patient" images reads as fake/untrustworthy
and has no real place here. Use icons, initials-based avatars (e.g. a
colored circle with a person's initials), abstract shapes, or simple
illustrations instead — never a photo of a person's face, stock or
otherwise.

**Animation is expected, not optional.** Every version of this app so
far has included motion, and it should stay a real part of the design,
not an afterthought:
- Page/panel transitions (fade + slight slide when switching views)
- Hover and press feedback on interactive elements (cards, buttons)
- Loading states that animate (skeleton shimmer, not a static gray box)
- Meaningful data animating in (e.g. a risk score/ring filling in rather
  than just appearing, a chart line drawing in)
- Keep it subtle and reassuring, not bouncy or playful — this is a
  health app, motion should build trust, not draw attention to itself.


---

## 6. Specific design requirements for this pass

- **No stock photos of people/faces anywhere in the UI.** Avatars should
  be initials, icons, or illustrated/abstract — not generic stock photography
  of faces. This is a health app handling sensitive data; photos of
  "random people" read as fake/untrustworthy and raise privacy-adjacent
  red flags even when they're just placeholder decoration. If imagery is
  wanted at all, prefer abstract/illustrative graphics, icons, or data
  visualization over photography of people.
- **Real animation, not just static screens.** Page transitions, hover
  states, loading states, and success/error feedback should all have
  motion — this should feel like a live, responsive product, not a set
  of flat mockup images. Keep it subtle and reassuring rather than
  bouncy or flashy (it's a health app), but motion should be genuinely
  present throughout, not an afterthought.
- **Skeleton loaders**, not spinners, on every data-heavy page.
- **Non-blocking notifications** for action feedback (save succeeded,
  error occurred, etc.).
- **Keyboard navigation and clear labeling** on all forms/dialogs — this
  needs to be genuinely accessible (WCAG 2.1 AA target), not just
  visually fine.
- **Responsive**, verified usable at three widths: 375px (mobile),
  768px (tablet), 1440px (desktop). The navigation in particular needs a
  real mobile pattern (bottom bar, drawer, etc. — not a squeezed sidebar).
- **Dark/light theme toggle**, fully designed for both modes, not just
  color-inverted.
- A **distinct clinician dashboard** — same visual language, but should
  feel like a different job-to-be-done (scanning/triage) than the
  patient's reflective/personal dashboard.



---

## 7. What "done" looks like for this design pass

A designer handing this back should deliver, for both light and dark
mode:
1. All 9 pages from section 3, each in loading/empty/error/populated
   states where applicable (section 4)
2. The three responsive breakpoints for at least the Dashboard, Records,
   and Clinician pages
3. A short component sheet: card, badge (all status colors), button
   (primary/secondary/destructive), input, risk-indicator component,
   skeleton pattern
4. Confirmation that every interactive element has a visible
   keyboard-focus state

If useful for a first pass, two rough interactive mockups already exist
showing one possible direction (teal/mint palette, card-based dashboard,
working dark-mode toggle) — treat them as a sketch of mood/density, not a
spec to copy exactly.
