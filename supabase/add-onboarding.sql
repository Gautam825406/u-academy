-- U++ Academy — ADD teacher onboarding (run on the LIVE Supabase project)
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- The live project already has all tables from schema.sql; this only adds
-- teacher_requests + onboarding_invites and their RLS policies.

create table if not exists public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, email text not null, mobile text,
  subject text, experience_years int, qualification text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists public.onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  full_name text not null, email text not null, mobile text,
  role text not null check (role in ('teacher','student')),
  class_label text, board text, subject text,
  status text not null default 'invited' check (status in ('invited','registered')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.teacher_requests enable row level security;
alter table public.onboarding_invites enable row level security;

do $$
begin
  drop policy if exists "public insert teacher_requests" on public.teacher_requests;
  drop policy if exists "public read teacher_requests" on public.teacher_requests;
  drop policy if exists "auth update teacher_requests" on public.teacher_requests;
  create policy "public insert teacher_requests" on public.teacher_requests for insert with check (true);
  create policy "public read teacher_requests" on public.teacher_requests for select using (true);
  create policy "auth update teacher_requests" on public.teacher_requests for update using (auth.role() = 'authenticated');

  drop policy if exists "auth read onboarding_invites" on public.onboarding_invites;
  drop policy if exists "auth write onboarding_invites" on public.onboarding_invites;
  drop policy if exists "auth update onboarding_invites" on public.onboarding_invites;
  create policy "auth read onboarding_invites" on public.onboarding_invites for select using (auth.role() = 'authenticated');
  create policy "auth write onboarding_invites" on public.onboarding_invites for insert with check (auth.role() = 'authenticated');
  create policy "auth update onboarding_invites" on public.onboarding_invites for update using (auth.role() = 'authenticated');
end $$;

create index if not exists idx_teacher_requests_email on public.teacher_requests(email);
create index if not exists idx_onboarding_invites_email on public.onboarding_invites(email);

-- Verify: both tables exist and are empty to start.
select 'teacher_requests' as table_name, count(*) from public.teacher_requests
union all
select 'onboarding_invites', count(*) from public.onboarding_invites;
