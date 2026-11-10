-- U++ Academy — ADD Test & Assessment Module
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- Extends the existing tests table (never drops/recreates it) and adds:
--   question_bank, test_questions, test_attempts, student_answers.
-- Questions are COPIED into test_questions when a test is created/published,
-- so later edits to the bank never invalidate submitted attempts.
-- Scoring is done SERVER-SIDE (src/app/api/tests/submit) from test_questions;
-- correct answers are never sent to the student client before release.
-- The old teacher-entered test_results flow is untouched.

-- ---------- Extend existing tests table (nullable, additive only) ----------
alter table public.tests add column if not exists description text;
alter table public.tests add column if not exists category text;
alter table public.tests add column if not exists difficulty text;
alter table public.tests add column if not exists duration_minutes int;
alter table public.tests add column if not exists start_at timestamptz;
alter table public.tests add column if not exists end_at timestamptz;
alter table public.tests add column if not exists max_attempts int not null default 1;
alter table public.tests add column if not exists randomize_questions boolean not null default false;
alter table public.tests add column if not exists randomize_options boolean not null default false;
alter table public.tests add column if not exists allow_revisit boolean not null default true;
alter table public.tests add column if not exists show_results text not null default 'immediate';
alter table public.tests add column if not exists show_answers boolean not null default true;
alter table public.tests add column if not exists show_explanations boolean not null default true;
alter table public.tests add column if not exists passing_marks numeric;
alter table public.tests add column if not exists instructions text;
alter table public.tests add column if not exists status text not null default 'draft';
alter table public.tests add column if not exists thumbnail_url text;
alter table public.tests add column if not exists published_at timestamptz;
alter table public.tests add column if not exists results_published boolean not null default false;

-- ---------- Reusable Question Bank ----------
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  subject text,
  topic text,
  question_type text not null default 'single',
  question_text text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  explanation text,
  marks numeric not null default 1,
  negative_marks numeric not null default 0,
  difficulty text not null default 'Medium',
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Questions frozen into a test (copied at creation) ----------
create table if not exists public.test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  question_bank_id uuid references public.question_bank(id) on delete set null,
  question_text text not null,
  question_type text not null default 'single',
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  explanation text,
  marks numeric not null default 1,
  negative_marks numeric not null default 0,
  difficulty text not null default 'Medium',
  subject text,
  topic text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Student attempts (one row per try) ----------
create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  attempt_number int not null default 1,
  question_order jsonb not null default '[]'::jsonb,
  option_orders jsonb not null default '{}'::jsonb,
  score numeric,
  max_marks numeric,
  percentage numeric,
  passed boolean,
  time_taken_seconds int,
  created_at timestamptz not null default now(),
  unique (test_id, student_id, attempt_number)
);

-- ---------- One answer per question per attempt ----------
create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_id uuid not null references public.test_questions(id) on delete cascade,
  selected jsonb not null default '[]'::jsonb,
  is_correct boolean,
  marks_awarded numeric,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- ---------- RLS: same permissive-authenticated pattern as schema.sql ----------
alter table public.question_bank enable row level security;
alter table public.test_questions enable row level security;
alter table public.test_attempts enable row level security;
alter table public.student_answers enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['question_bank','test_questions','test_attempts','student_answers']) loop
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

-- ---------- Indexes ----------
create index if not exists idx_question_bank_teacher on public.question_bank(teacher_id);
create index if not exists idx_question_bank_subject on public.question_bank(subject);
create index if not exists idx_question_bank_batch on public.question_bank(batch_id);
create index if not exists idx_test_questions_test on public.test_questions(test_id);
create index if not exists idx_test_attempts_test on public.test_attempts(test_id);
create index if not exists idx_test_attempts_student on public.test_attempts(student_id);
create index if not exists idx_student_answers_attempt on public.student_answers(attempt_id);
create index if not exists idx_student_answers_question on public.student_answers(question_id);

-- Verify: tables exist (counts start at 0; tests keeps its existing rows).
select 'question_bank' as table_name, count(*) from public.question_bank
union all select 'test_questions', count(*) from public.test_questions
union all select 'test_attempts', count(*) from public.test_attempts
union all select 'student_answers', count(*) from public.student_answers
union all select 'tests', count(*) from public.tests;
