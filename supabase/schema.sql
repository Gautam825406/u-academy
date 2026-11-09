-- U++ Academy — Supabase schema
-- Run in Supabase Dashboard > SQL Editor (paste whole file, Run).
-- Starts EMPTY: no sample users, batches or data. First registered user becomes Admin
-- via the app code (see src/app/auth/register/page.tsx) — see note at the end.
-- Requires: Supabase Auth enabled (Email provider on, default).

create extension if not exists "pgcrypto";

-- ---------- Profiles (1 row per auth user) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  mobile text,
  role text not null check (role in ('student','teacher','parent','admin')),
  class_label text,          -- student: "Class 10"
  board text,                -- student: CBSE / ICSE / State Board
  subject text,              -- teacher: Mathematics, Science, ...
  child_name text,           -- parent
  child_student_id text,     -- parent: link code / student id
  institute_name text,       -- admin
  city text,                 -- admin
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- SECURITY DEFINER helper: checks the caller's admin role WITHOUT querying
-- profiles under RLS. The old EXISTS (select from profiles) check inside a
-- profiles policy caused infinite recursion (ERROR 42P17) and made every
-- profile read fail — dashboard showed "No profile found" even though the
-- row existed. Never put a profiles subquery inside a profiles policy.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can update all profiles" on public.profiles for update using (public.is_admin());
-- Insert is done by the app right after signUp (authenticated user inserts own row).
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- ---------- Batches ----------
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null, class_label text not null, board text, subject text,
  teacher_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (batch_id, student_id)
);

-- ---------- Lectures / Materials ----------
create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null, subject text, chapter text, youtube_url text, notes text,
  duration_minutes int, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null, kind text, file_url text, description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Assignments / Submissions ----------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null, subject text, description text, due_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer_text text, file_url text, marks numeric, feedback text, status text default 'submitted',
  created_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- ---------- Tests / Results ----------
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null, subject text, total_marks numeric default 50, test_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.test_results (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  marks numeric, remarks text,
  created_at timestamptz not null default now(),
  unique (test_id, student_id)
);

-- ---------- Attendance ----------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  att_date date not null, status text not null check (status in ('present','absent')),
  marked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (batch_id, student_id, att_date)
);

-- ---------- Fees (manual — no payment gateway) ----------
create table if not exists public.fees (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  amount numeric not null, status text not null default 'pending' check (status in ('pending','paid')),
  receipt_no text, due_month text, paid_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Live classes / Doubts / Announcements / Notifications ----------
create table if not exists public.live_classes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete set null,
  title text not null, subject text, meet_url text, starts_at timestamptz, status text default 'scheduled',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.doubts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  question text not null, answer text, status text default 'open' check (status in ('open','answered')),
  created_at timestamptz not null default now()
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text, audience text default 'all',
  batch_id uuid references public.batches(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null, body text, is_read boolean default false,
  created_at timestamptz not null default now()
);
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  student_name text not null, parent_mobile text, class_label text, board text,
  interested_in text, notes text, created_at timestamptz not null default now()
);

-- ---------- Role permissions: 14 features x 4 roles ----------
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('student','teacher','parent','admin')),
  feature_key text not null,
  enabled boolean not null default true,
  unique (role, feature_key)
);
-- Defaults: Admin all on; other roles sensible defaults (app also enforces server-side).
insert into public.role_permissions (role, feature_key, enabled)
select r.role, f.feature_key, case when r.role='admin' then true else f.default_on end
from (values ('student'),('teacher'),('parent'),('admin')) r(role)
cross join (values
  ('overview',true),('batches',true),('lectures',true),('materials',true),
  ('assignments',true),('tests',true),('live_classes',true),('attendance',true),
  ('fees',true),('doubts',true),('notifications',true),('reports',false),
  ('users',false),('permissions',false)
) f(feature_key, default_on)
on conflict (role, feature_key) do nothing;

-- ---------- RLS: authenticated users can read/write their own academy's rows ----------
-- Simple, permissive-authenticated policy set (RLS enabled; refine per-row in production
-- if you need strict batch-level isolation). Service-role key bypasses RLS for admin jobs.
do $$
declare t text;
begin
  for t in select unnest(array[
    'batches','enrollments','lectures','materials','assignments','submissions',
    'tests','test_results','attendance','fees','live_classes','doubts',
    'announcements','notifications','role_permissions']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "auth read %I" on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth write %I" on public.%I for insert with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth update %I" on public.%I for update using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth delete %I" on public.%I for delete using (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;
-- Enquiries: anyone may insert (public demo form); only authenticated users may read.
alter table public.enquiries enable row level security;
create policy "anon insert enquiries" on public.enquiries for insert with check (true);
create policy "auth read enquiries" on public.enquiries for select using (auth.role() = 'authenticated');

-- ---------- Indexes ----------
create index if not exists idx_enrollments_batch on public.enrollments(batch_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_lectures_batch on public.lectures(batch_id);
create index if not exists idx_assignments_batch on public.assignments(batch_id);
create index if not exists idx_submissions_assignment on public.submissions(assignment_id);
create index if not exists idx_attendance_student on public.attendance(student_id);
create index if not exists idx_fees_student on public.fees(student_id);
create index if not exists idx_doubts_student on public.doubts(student_id);
create index if not exists idx_notifications_user on public.notifications(user_id);

-- ---------- Storage (run in Dashboard > Storage, or via SQL) ----------
-- Create a public bucket named "materials" in Storage, then add this policy in
-- Storage > Policies, or run:  insert into storage.buckets (id, name, public)
-- values ('materials','materials', true) on conflict do nothing;
-- Authenticated users may upload/download files in that bucket; files are linked
-- from materials.file_url / submissions.file_url.

-- ---------- First-user-becomes-Admin ----------
-- There is intentionally NO database trigger that promotes the first user.
-- The register page checks `select count(*) from profiles`; if 0, it assigns
-- role 'admin' regardless of the picker (and tells the user). After that, new
-- registrations keep the role they chose, and only an Admin can change roles
-- in Dashboard > Users. This keeps the rule visible and auditable in app code.
