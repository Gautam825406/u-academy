# U++ Academy — Free Vercel + Supabase Production Version

Tuition & coaching app for Classes 6–12 (CBSE / ICSE / State Board).
Next.js 14 (App Router, TypeScript) + Tailwind CSS + Supabase Auth / Postgres.
Starts empty — no sample users, no demo logins. **The first account you register becomes Admin.**

## What is included

- **Landing page** matching the reference UI: teal/green `#0c7a5f`, amber `#f2a007`, Plus Jakarta Sans, sticky header, hero *“Your marks, levelled up. U++”*, interactive phone mockup (Home / Lectures / Tests / Progress + 3-question practice quiz), 6 courses with class-band filters (Foundation Builder 6–8, Board Excellence 9–10, Senior Secondary Science 11–12, Senior Secondary Commerce 11–12, Revision Plus Online, Sunday Test Series), Why U++, Student/Parent/Teacher tabs, 3 joining steps, 5 FAQs, free demo enquiry form (saves to Supabase `enquiries`).
- **Auth:** register/login with a 4-role picker (Student / Teacher / Parent / Admin) and role-specific fields — student class + board, teacher subject, parent child name + student ID, admin institute + city. Show/hide password, forgot-password email reset, session via Supabase Auth, `/dashboard` protected by middleware.
- **Dashboards (all 4 roles):** desktop left sidebar with **all 15 sections** — Overview, Batches, Lectures, Study Materials, Assignments, Exams & Tests, Live Classes, Attendance, Fees & Receipts, Doubts & Chat, Notifications, Reports, Users, Permissions, Profile — grouped, with `Off` / `Admin` tags. Mobile: sticky top bar, bottom tab bar (Home, Batches, Lectures, Tasks, More), More sheet, slide-in sidebar. Overview has a Jump-to shortcut grid filtered by role permissions.
- **Working CRUD (list + create) via Supabase** for batches (with teacher assignment + student enrolment), lectures (batch picker + working YouTube embed), materials (batch picker, kind, file URL), assignments (batch picker, student submission, teacher grading with marks/feedback), tests (batch picker, marks entry per student, class average, own-result view), live classes (batch picker, datetime-local start, Join button), doubts (batch picker, inline teacher reply), announcements + notifications (audience-based, mark read), fees (Admin student/batch picker, auto receipt `U++-2026-XXXX`, mark-as-paid, collected/pending totals), attendance (full batch roster grid, save-all), users (role change, block/unblock, parent-to-child linking, enrolments shown) and role permissions (Admin toggle). Reports shows per-student attendance %, test average, assignments submitted/graded and fees, with a CSV download, plus landing-page enquiries. Profile is editable. Parents see their linked child's data in fees/attendance/tests/submissions.
- **Teacher onboarding + Admin invites:** teachers apply from a “Join as a Teacher” form on the landing page (saved to `teacher_requests`); Admin approves/rejects in Dashboard > Users. Admin can also directly onboard a teacher or student (Dashboard > Users > Onboard teacher / student), creating an `onboarding_invites` row — the invitee then registers on the live site with the exact invited email, and the register page confirms their approved/invited role (and marks the invite `registered`). Run `supabase/add-onboarding.sql` on a live project that already has the base schema.
- **ClassWalla-style “Today” dashboard:** Overview shows KPI cards (Total Students, Fees Collected This Month, Fees Due/Pending, Attendance Today %, New Leads, Pending Doubts) plus upcoming live classes and a To-do list (absent today, overdue fees, pending teacher requests, unanswered doubts) linking to each section.
- **Courses, bundles & pricing:** in Batches, create paid/free courses with a bundle name, and enrol students into a course with a coupon code and price paid.
- **Coupons:** in Reports, create coupon codes (% off, valid until, active toggle); coupons apply in Fees and in course enrolments.
- **Fees with UPI:** Fees & Receipts records payment mode (Cash / UPI / Bank Transfer), a UPI reference/transaction ID, a coupon code (discount applied to the amount), and an institute UPI ID shown on receipts. Recorded only — there is no online payment gateway connected.
- **Certificates:** in Exams & Tests, any student scoring >= 40% gets a “🏆 Certificate” button opening a printable certificate (name, test, marks, date, institute) with a Print button.
- **Weekly timetable:** in Live Classes, create timetable rows (batch, day, start/end time, subject, teacher) shown as a Monday–Sunday grid.
- **Leads CRM:** in Reports, every landing-page enquiry is a lead with status (new/contacted/enrolled/rejected), follow-up date, and “Convert to invite” (creates an onboarding invite for the student once you enter their email).
- **Physics Wallah-style batch subscriptions:** Admin creates subscription plans per batch in Batches (Monthly / Quarterly / Half-Yearly / Yearly / Full Course, with price, struck-through MRP, discount %, validity in days, features). A student picks a plan on the batch card and pays that price via Cashfree; on a verified PAID order the app creates a `subscriptions` row (valid from today until today + plan duration) and enrols them. Free plans enrol directly with a subscription. Students see "My subscriptions" on Overview with plan, valid-until, Active/Expired status and a Renew button. **Role access:** a student sees lectures, materials, assignments, tests and live classes only for batches where they hold an *active* subscription (expired = hidden, with a note to enrol); a teacher sees only their own batches (`teacher_id`) and their students, with each student's plan + expiry in Batches; Admin sees everything; a parent sees their linked child's subscriptions and content. Run `supabase/add-pw-subscriptions.sql` on a live project that already has the base schema.
- **Cashfree pay-and-enrol:** Admin sets a price (₹, 0 = free), capacity and status on each batch in Batches. A student who registers and logs in sees every batch as a card with its price and status; if not enrolled, they tap **“Enroll — Pay ₹X via Cashfree”** (or “Enroll free”). Paid batches go through Cashfree Checkout; on return the app verifies the order with Cashfree and only then enrols the student, marks the payment paid, and records a paid fee receipt. Admin sees every Cashfree order in Batches > Payments. Run `supabase/add-cashfree.sql` on a live project that already has the base schema. See “Cashfree payments” below — keys are required, and without them enrolment falls back to cash/UPI at the institute.
- **Fees are manual** — no payment gateway. Record a fee demand/payment in Fees & Receipts; UPI payments are recorded with their reference, not collected online.

## Free deploy — step by step

### 1. Create a free Supabase project (5 min)
1. Go to https://supabase.com → Sign up (free) → New project. Pick a name, a database password (save it), and a region close to India (e.g. Mumbai / Singapore).
2. Wait for it to finish, then open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates all tables, RLS policies, indexes, and seeds `role_permissions` (14 features × 4 roles). On a project where the base schema is already live, run `supabase/add-onboarding.sql` to add only the teacher-onboarding tables (`teacher_requests`, `onboarding_invites`), `supabase/add-classwalla.sql` to add the ClassWalla-style tables (`courses`, `coupons`, `timetable`, `course_enrollments`) plus the new `fees`/`enquiries` columns, `supabase/add-cashfree.sql` to add the `payments` table and the batch price/capacity/status columns, and `supabase/add-pw-subscriptions.sql` to add batch subscription plans (`batch_plans`, `subscriptions`) plus plan/validity columns on `enrollments`/`payments`.
3. Go to **Project Settings → API** and copy: Project URL and `anon public` key.
4. **Auth:** go to **Authentication → Providers → Email** and make sure Email is enabled. For the easiest first run, turn **OFF** “Confirm email” (Authentication → Providers → Email → Confirm email) — otherwise the first user must click a confirmation email before their profile row can be created. You can turn it back on later.
5. **Storage (optional, for materials):** Storage → Create bucket `materials`, make it Public. Files uploaded later are linked from `materials.file_url`.

### 2. Push the code to GitHub
```bash
cd u-academy-vercel-supabase
git init
git add .
git commit -m "U++ Academy — free Vercel + Supabase version"
# Create an empty repo on github.com, then:
git remote add origin https://github.com/<your-username>/u-academy.git
git push -u origin main
```
Never commit `.env.local` — it is in `.gitignore`. Only `.env.example` (placeholders) is committed.

### 3. Deploy free on Vercel (free Hobby plan)
1. Go to https://vercel.com → Sign up with GitHub → **Add New → Project** → Import your `u-academy` repo.
2. Framework is auto-detected as Next.js. Leave Build Command `npm run build` and Output as default.
3. **Environment Variables** — add exactly these (from Supabase step 1.3):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service-role key (optional; only if you later add server admin actions)
   - Cashfree (only if you take online payments — see “Cashfree payments” below): `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` (`SANDBOX` for testing, `PROD` for real money)
4. Click **Deploy**. You get a free URL like `https://u-academy.vercel.app`. Every push to GitHub redeploys automatically.

### 4. First run — you become Admin
1. Open your Vercel URL → **Register**. Fill the form (pick any role — the app promotes the first-ever account to Admin and tells you).
2. Log in. As Admin: **Dashboard → Batches → Create** your first batch, **Users** to add/block teachers & students, **Permissions** to switch features on/off per role.
3. Teachers/students/parents then register normally and keep the role they chose.

### 5. Run it locally (optional)
```bash
npm install
cp .env.example .env.local   # then fill in your real Supabase URL + anon key
npm run dev                   # http://localhost:3000
npm run build                 # production build check
```

## Cashfree payments (pay-and-enrol)

**How Admin gets the keys (Sandbox first, Production when you go live):**
1. Sign up / sign in at https://www.cashfree.com → Cashfree Dashboard → **Developers → API Keys**.
2. Copy the **App ID** and **Secret Key** for the **Sandbox** environment first (test mode, no real money). Later, switch to the **Production** keys when you are ready to take real payments.
3. In Vercel: Project `u-academy` → **Settings → Environment Variables** → add `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_ENV` (`SANDBOX` or `PROD`) for Production (and Preview, if you test preview deploys) → **Redeploy**.
4. In Supabase, run `supabase/add-cashfree.sql` once (creates the `payments` table and adds price/capacity/status to `batches`).

**The student flow:**
1. Admin sets a price on a batch in Dashboard > Batches (₹, 0 = free), plus capacity and status (Active / Upcoming / Closed).
2. A student registers, logs in, and opens **Batches** — every batch is shown as a card with its price. Overview also shows “My batches” for students.
3. The student picks a subscription plan on the batch card (or pays the batch price if no plan exists) and taps **“Enroll — Pay ₹X via Cashfree”** (or “Enroll free” for a free plan/batch). The app calls `/api/cashfree/create-order` with `{ batch_id, plan_id }`, which creates a Cashfree PG order (api-version 2023-08-01) and sends the student to Cashfree Checkout (UPI / cards / netbanking / wallets, as Cashfree offers).
4. After payment, Cashfree returns the student to `/api/cashfree/return`, which verifies the order directly with Cashfree. **Only when Cashfree says `PAID`** does the app enrol the student, mark the payment paid, and record a paid fee receipt (`U++-CF-…`). If the payment fails, the student is not enrolled and can retry.
5. Admin sees every order in **Batches > Payments** (student, batch, amount, order ID, status).

**Honest fallback (no keys yet):** if `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` are not set in Vercel, the pay button shows “Cashfree is not set up yet. Pay at the institute in cash/UPI — Admin will confirm your enrolment in Batches.” Free batches always enrol directly with no payment. No money ever moves through the app without Cashfree keys, and no keys are stored in the code — only in Vercel env vars.

## Free-tier limits (what costs later)
- **Vercel Hobby — free:** 100 GB bandwidth/month, unlimited static deploys, `*.vercel.app` domain. Custom domain is free to connect on Hobby; the domain itself costs ~₹800/year from a registrar (optional).
- **Supabase Free — free:** 500 MB database, 50k monthly active users, 1 GB file storage, 2 GB bandwidth. Plenty for a small academy.
- **What costs later:** only if you outgrow those limits, add a paid database/storage tier, or add Razorpay (payment gateway fees per transaction). Nothing in this codebase charges you.

## Installable PWA / Android APK
- The site is a PWA: `public/manifest.webmanifest` (name "U++ Academy", display standalone, theme #07573f, 192/512 PNG icons + SVG fallback), `public/sw.js` service worker (cache-first static assets, network-first pages/API), registered by `src/components/RegisterSW.tsx` in the layout. An "Install U++ app" button appears on the landing page and dashboard Overview only when the browser fires `beforeinstallprompt`.
- To make an APK: deploy, then open https://www.pwabuilder.com, enter the live URL (https://u-academy-zeta.vercel.app/), let it score the PWA, and download the Android package (AAB/APK). PWABuilder needs the live site served over HTTPS with a valid manifest + service worker + 512px icon — all included here. The APK is not generated by this repo; PWABuilder (or a Play Store upload of its AAB) produces it.

## Honest notes / intentional limits
- **Fees / Cashfree:** online payment works only after Admin adds the Cashfree keys in Vercel (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`) and runs `supabase/add-cashfree.sql`. Until then, fees are manual — receipts are recorded in the app with auto-generated receipt numbers; UPI is record-only (mode + reference + institute UPI ID), no money moves through the app.
- **No push notifications** — announcements appear as in-app notifications; there is no push service on the free tier, and the dashboard says so rather than faking it.
- **File uploads:** materials and submissions link to a file URL (e.g. Google Drive / public PDF link). There is no in-app file-upload button — create a public `materials` bucket in Supabase Storage and paste the file URL.
- **Parent linking:** a parent sees their child's data only once `child_student_id` is set — either at registration (parent enters the child's student ID) or by an Admin linking them in Dashboard > Users. If it is not set, a parent sees no child data.
- **Onboarding — honest limit:** Admin invites; the invitee registers themselves. With only the anon key in Vercel (no service-role key), Admin **cannot** create auth accounts or set anyone's password — the invitee chooses their password at registration. A teacher with a pending (not yet approved) request can still register; Admin then confirms their teacher role. Teacher requests are public-readable by email so the register page can check an applicant's status before sign-up; invites are authenticated-only and are checked after sign-up, once the invitee has a session.
- **No sample/demo data, no demo logins** — by design. If the dashboard looks empty after first deploy, that is correct: create a batch first.
