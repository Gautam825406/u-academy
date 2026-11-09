# U++ Academy — Student Experience Audit & Fixes (9 Nov 2026)

Live site: https://u-academy-zeta.vercel.app/ — codebase: `~/workspace/u-academy-vercel-supabase/`
(Next.js 14 App Router + Supabase Auth/Postgres + Cashfree PG). This audit covers the
**student** experience only. Admin/Teacher features were kept intact.

## Root causes found

### 1. Reports / admin modules visible to students
- The sidebar listed **all 15 sections for every role** (grouped by index arithmetic,
  `Math.floor(i / 4)`), with Reports/Users/Permissions merely tagged "Admin"/"Off".
  Clicking one showed an "Admin-only / switched Off" card — the module was still
  reachable, and the student Overview showed institute-wide KPIs (Total Students,
  New Leads, Pending Teacher Requests) that are Admin numbers.
- `isEnabled()` defaulted to **true when no permission row existed**, so a missing
  row silently enabled a feature.
- **Fix:** `ROLE_SECTIONS` in `src/app/dashboard/page.tsx` — students get exactly
  11 sections (Overview, My Batches, Live Classes, Recorded Lectures, Assignments,
  Doubt Forum, Study Materials, Announcements, Attendance, My Payments,
  Profile & Settings). Teachers keep teaching + Reports, never Users/Permissions.
  Admin keeps everything. Both `openSection()` and the render guard enforce the
  list — a student cannot open Reports/Users/Permissions by state, deep link, or
  the mobile More sheet. The sidebar, bottom tab bar and More sheet all render
  from the same list.

### 2. Dashboard fetched everything for everyone (data exposure)
- `loadAll()` fetched **every row of every table for every role** — a student
  client received all profiles, fees and payments.
- **Fix:** role-scoped loading. Students/parents fetch only their own enrolments,
  subscriptions, payments, fees, attendance, submissions and results, and batch
  content only for batches with an active enrolment/subscription. Teachers load
  only their own batches + their students. Admin still loads everything.
- **Honest limit:** this is a frontend query scope, NOT per-batch RLS. Supabase
  policies remain the permissive authenticated-user set (see schema.sql). A
  determined user could still query another batch's rows directly with the anon
  key. True row isolation needs per-batch RLS policies (or server API routes
  with the service-role key) — a bigger change, deliberately not attempted here
  because it would break the existing Admin/Teacher flows that rely on the
  permissive set. The forum migration keeps the same permissive pattern.

### 3. Paid batch not appearing in My Batches after login
Three separate bugs, all fixed:
- **(a) Enrolment without a subscription row fell through to "Pay again".**
  The batch card showed "Enrolled" only when a *subscription* row existed and
  was active. An Admin/manual enrol (or a free enrol from before plans existed)
  has no subscription row, so the card offered "Enroll — Pay ₹X" again even
  though the student was enrolled. Fix: an `enrollments` row is the source of
  truth — enrolled students now always see "✓ Enrolled" (grandfathered).
- **(b) Renewal was impossible.** `create-order` rejected any purchase when an
  `enrollments` row existed, even an expired one — the Renew button could never
  work. Fix: only an *active* enrolment blocks a new order; expired/cancelled
  enrolments may buy again (upsert renews them).
- **(c) Duplicate enrolment/subscription/receipt on repeat processing.**
  The return route inserted a new `subscriptions` row and a new `fees` row on
  every visit, with no check whether the order was already paid. If Cashfree
  redirected twice, or the webhook also ran, the student got duplicate
  subscriptions and duplicate receipts. Fix: both the return route and the
  webhook now check `payments.status` first (already paid → stop), check for
  an existing subscription with that `order_id`, and check for an existing
  fee receipt before inserting. `enrollments` already had
  `unique (batch_id, student_id)` and is upserted.
- Enrolment data lives in Postgres (`enrollments` + `subscriptions`), is
  re-fetched from the DB on every dashboard load, and is never stored in
  localStorage — so a purchased batch survives logout/login.
- Stale-list note: the dashboard sometimes showed old data until a reload
  (pre-existing). `loadAll()` now re-runs on every section change and after
  every write, which reduces it; a full fix (realtime/optimistic refresh)
  is still open.

### 4. Cashfree gaps
- **No webhook at all.** If a student closed the browser after paying (or the
  redirect failed), no enrolment was ever created — the return redirect was
  the *only* enrolment path. Fix: new `src/app/api/cashfree/webhook/route.ts`
  (see below).
- **No signature verification.** Fix: the webhook verifies Cashfree's
  HMAC-SHA256 signature — `Base64(HMAC-SHA256(secret, timestamp + rawBody))`
  against the `x-webhook-signature` / `x-webhook-timestamp` headers, constant-
  time compare, timestamps older than 5 minutes rejected (replay protection).
  Source: https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
- **No idempotency** — see 3(c).
- **Payment statuses incomplete.** `payments.status` only allowed
  `created/paid/failed`. Fix: `supabase/add-payments-status.sql` widens it to
  `created/pending/paid/successful/failed/refunded` (looks the unnamed inline
  constraint up in `pg_constraint`, so it works on the live DB).
- **No payment result screen.** The return route redirected to the dashboard
  with `?paid=1`, which a URL alone could fake. Fix: the return route now
  redirects to new `src/app/payment/result/page.tsx`, which reads the
  `payments` row from the DB by `order_id` — the DB is the source of truth,
  URL params only carry the order id.
- **Webhook + RLS — new env var required.** The webhook is server-to-server
  with no user session, so the anon key has role `anon` and the project's
  `authenticated`-only RLS policies would block its writes. The webhook
  therefore uses `SUPABASE_SERVICE_ROLE_KEY` when set (server-only, bypasses
  RLS) and falls back to the anon client with a console warning otherwise.
  **Admin must add `SUPABASE_SERVICE_ROLE_KEY` in Vercel (Secret,
  Production) and set the Cashfree notify URL to
  `https://u-academy-zeta.vercel.app/api/cashfree/webhook`, or webhook
  enrolment will not work.** The return route (browser redirect, user
  session present) keeps working without it.
- Keys stay server-only: `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` are read
  only in server routes; no secret is in client code. Verified.

### 5. Doubts were a single-answer chat, not a forum
- The old `doubts` table held one `question` + one `answer` text; only staff
  could answer (overwriting the previous answer), students saw only their own
  doubts, and there was no voting, threading, accept, search or notification.
- **Fix:** new migration `supabase/add-doubt-forum.sql` — `doubt_questions`
  (title, body, subject, batch, image URL, status open/answered/resolved),
  `doubt_answers` (threaded via `parent_answer_id`, `is_accepted`),
  `doubt_votes` (unique per answer+user). New Doubt Forum UI in the dashboard:
  Ask a Doubt form (title, description, subject, batch picker, screenshot URL
  — no in-app upload exists in this project, a public link is used),
  tabs Recent / Unanswered / My Questions / Most Helpful, search + subject /
  batch / status filters, question cards (asker, title, subject, date, answer
  count, upvotes, status), threaded answers with reply, upvote toggle, Mark
  as accepted (asker or teacher only), and a notification row for the asker
  when someone answers. Teachers can answer and resolve. The old `doubts`
  table is untouched (existing rows remain readable by Admin); the forum
  reads the new tables.

## Files changed
- `src/app/dashboard/page.tsx` — role-based sidebar/guard, student Overview,
  scoped `loadAll()`, My Batches enrolment fix, My Payments (Cashfree) list,
  Doubt Forum UI, role-based bottom tabs / More sheet.
- `src/app/api/cashfree/create-order/route.ts` — renewal allowed for
  expired/cancelled enrolments.
- `src/app/api/cashfree/return/route.ts` — idempotent, redirects to
  `/payment/result?order_id=…`, never overwrites a paid row with a failure.
- `src/app/api/cashfree/webhook/route.ts` — **new**: verified, idempotent
  Cashfree webhook (needs `SUPABASE_SERVICE_ROLE_KEY` in Vercel).
- `src/app/payment/result/page.tsx` — **new**: payment success/failure/
  pending screen from the DB row.
- `supabase/add-doubt-forum.sql` — **new migration** (run in Supabase).
- `supabase/add-payments-status.sql` — **new migration** (run in Supabase).
- `.env.example` — documents `SUPABASE_SERVICE_ROLE_KEY` (server-only).
- `AUDIT.md` — this file.

## Migrations to run in Supabase SQL Editor (in order)
1. `supabase/add-doubt-forum.sql`
2. `supabase/add-payments-status.sql`

No other migration is needed — `enrollments` already has the unique
`(batch_id, student_id)` constraint. If duplicate enrolments already exist
in the live DB, the unique constraint would already have prevented them;
no dedupe step is required.

## Also to do in Cashfree / Vercel (Admin)
- Vercel → u-academy → Settings → Environment Variables: add
  `SUPABASE_SERVICE_ROLE_KEY` (Secret, Production) from Supabase
  Dashboard → Project Settings → API → service_role key. Redeploy.
- Cashfree Dashboard → Developers → Webhooks: set the notify URL to
  `https://u-academy-zeta.vercel.app/api/cashfree/webhook`.
  (Without these two steps the webhook cannot enrol; the return route
  still works as before.)

## Build
- `rm -rf node_modules .next; npm install; NEXT_PUBLIC_SUPABASE_URL=…
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build` — **compiled
  successfully** 9 Nov 2026 (~20:35 IST), 11/11 routes including the new
  `/api/cashfree/webhook` and `/payment/result` routes. One build error was
  found and fixed during verification: a TS narrowing error at
  `dashboard/page.tsx` (the old student "My subscriptions" card became
  unreachable after the student Overview early-return) — the card was
  removed and its Renew action moved into the student Overview's enrolled
  batches list.
- Zip rebuilt: `~/workspace/u-academy.zip`, **117K**, verified to contain the
  new webhook route, payment result page, both migrations and AUDIT.md.

## Still needs a live smoke test (not run here — no real payment was made)
1. Real ₹10 Cashfree payment: student buys a ₹10 plan → payment success
   screen shows the order → batch appears in My Batches → logout, login
   again, batch is still there and lectures/materials/assignments open.
2. Renewal: let a plan expire (or use a 1-day test plan) → Renew works
   instead of "already enrolled".
3. Doubt flow: Student A posts a doubt → Student B answers → Student A
   gets a notification → Student A marks the answer accepted → status
   becomes Resolved; teacher answers another doubt.
4. Role check: log in as a student and confirm Reports/Users/Permissions
   are nowhere in the sidebar, bottom tabs or More sheet, and that opening
   `/dashboard` with those sections is refused.
5. Webhook: after the env var + notify URL are set, pay once and confirm
   the enrolment appears even if the browser is closed right after paying
   (webhook path), with exactly one subscription and one fee receipt.
