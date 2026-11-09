# U++ Academy — Free Vercel + Supabase Production Version

Tuition & coaching app for Classes 6–12 (CBSE / ICSE / State Board).
Next.js 14 (App Router, TypeScript) + Tailwind CSS + Supabase Auth / Postgres.
Starts empty — no sample users, no demo logins. **The first account you register becomes Admin.**

## What is included

- **Landing page** matching the reference UI: teal/green `#0c7a5f`, amber `#f2a007`, Plus Jakarta Sans, sticky header, hero *“Your marks, levelled up. U++”*, interactive phone mockup (Home / Lectures / Tests / Progress + 3-question practice quiz), 6 courses with class-band filters (Foundation Builder 6–8, Board Excellence 9–10, Senior Secondary Science 11–12, Senior Secondary Commerce 11–12, Revision Plus Online, Sunday Test Series), Why U++, Student/Parent/Teacher tabs, 3 joining steps, 5 FAQs, free demo enquiry form (saves to Supabase `enquiries`).
- **Auth:** register/login with a 4-role picker (Student / Teacher / Parent / Admin) and role-specific fields — student class + board, teacher subject, parent child name + student ID, admin institute + city. Show/hide password, forgot-password email reset, session via Supabase Auth, `/dashboard` protected by middleware.
- **Dashboards (all 4 roles):** desktop left sidebar with **all 15 sections** — Overview, Batches, Lectures, Study Materials, Assignments, Exams & Tests, Live Classes, Attendance, Fees & Receipts, Doubts & Chat, Notifications, Reports, Users, Permissions, Profile — grouped, with `Off` / `Admin` tags. Mobile: sticky top bar, bottom tab bar (Home, Batches, Lectures, Tasks, More), More sheet, slide-in sidebar. Overview has a Jump-to shortcut grid filtered by role permissions.
- **Working CRUD (list + create) via Supabase** for batches, lectures, materials, assignments, tests, live classes, doubts, announcements, fees, attendance, notifications, users (block/unblock) and role permissions (Admin toggle). Reports shows live counts; export CSV from Supabase Table Editor.
- **Fees are manual** — no payment gateway. Record a fee demand/payment in Fees & Receipts; add Razorpay later if you want online payment.

## Free deploy — step by step

### 1. Create a free Supabase project (5 min)
1. Go to https://supabase.com → Sign up (free) → New project. Pick a name, a database password (save it), and a region close to India (e.g. Mumbai / Singapore).
2. Wait for it to finish, then open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates all tables, RLS policies, indexes, and seeds `role_permissions` (14 features × 4 roles).
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

## Free-tier limits (what costs later)
- **Vercel Hobby — free:** 100 GB bandwidth/month, unlimited static deploys, `*.vercel.app` domain. Custom domain is free to connect on Hobby; the domain itself costs ~₹800/year from a registrar (optional).
- **Supabase Free — free:** 500 MB database, 50k monthly active users, 1 GB file storage, 2 GB bandwidth. Plenty for a small academy.
- **What costs later:** only if you outgrow those limits, add a paid database/storage tier, or add Razorpay (payment gateway fees per transaction). Nothing in this codebase charges you.

## Honest notes / intentional limits
- **Fees form:** the starter Fees form records a fee against the signed-in account as a placeholder. For the full Admin flow, create the fee in Supabase Table Editor (or extend the form with a student picker) and set `student_id` to the student's profile id — the schema already supports it.
- **Attendance:** the starter form records one row per submit. A full class-roster marking grid (all students in a batch at once) is not built — add it in `src/app/dashboard/page.tsx` under the `attendance` section.
- **Doubt answers:** teachers answer via the `doubts` table (set `answer` + `status='answered'`); an inline reply box in the dashboard is not built yet.
- **Submissions / grading:** the schema has `submissions` (marks + feedback). The dashboard currently covers assignment creation/listing; the student upload + teacher grading UI is the next feature to add on top of this starter.
- **No sample/demo data, no demo logins** — by design. If the dashboard looks empty after first deploy, that is correct: create a batch first.
