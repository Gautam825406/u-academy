-- U++ Academy — ADD ClassWalla-style features (run on the LIVE Supabase project)
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- The live project already has all tables from schema.sql; this only adds
-- courses, coupons, timetable, course_enrollments, plus new columns on
-- fees (payment_mode, upi_reference, coupon_code) and enquiries
-- (status, follow_up_date).

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null, class_label text, subject text, description text,
  price numeric not null default 0, is_paid boolean not null default false,
  bundle_name text, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, discount_percent numeric not null default 0,
  valid_until date, is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.timetable (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.batches(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time text, end_time text, subject text,
  teacher_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  price_paid numeric not null default 0, coupon_code text,
  created_at timestamptz not null default now(),
  unique (course_id, student_id)
);

alter table public.fees add column if not exists payment_mode text;
alter table public.fees add column if not exists upi_reference text;
alter table public.fees add column if not exists coupon_code text;
alter table public.enquiries add column if not exists status text not null default 'new' check (status in ('new','contacted','enrolled','rejected'));
alter table public.enquiries add column if not exists follow_up_date date;

alter table public.courses enable row level security;
alter table public.coupons enable row level security;
alter table public.timetable enable row level security;
alter table public.course_enrollments enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['courses','coupons','timetable','course_enrollments']) loop
    execute format('drop policy if exists "auth read %I" on public.%I', t, t);
    execute format('drop policy if exists "auth write %I" on public.%I', t, t);
    execute format('drop policy if exists "auth update %I" on public.%I', t, t);
    execute format('drop policy if exists "auth delete %I" on public.%I', t, t);
    execute format('create policy "auth read %I" on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth write %I" on public.%I for insert with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth update %I" on public.%I for update using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth delete %I" on public.%I for delete using (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;

create index if not exists idx_courses_bundle on public.courses(bundle_name);
create index if not exists idx_course_enrollments_course on public.course_enrollments(course_id);
create index if not exists idx_course_enrollments_student on public.course_enrollments(student_id);
create index if not exists idx_timetable_batch on public.timetable(batch_id);
create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_enquiries_status on public.enquiries(status);

-- Verify: new tables exist (counts start at 0).
select 'courses' as table_name, count(*) from public.courses
union all select 'coupons', count(*) from public.coupons
union all select 'timetable', count(*) from public.timetable
union all select 'course_enrollments', count(*) from public.course_enrollments;
