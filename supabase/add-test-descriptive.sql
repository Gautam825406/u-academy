-- U++ Academy — ADD descriptive / essay questions to the Test & Assessment Module
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- Do NOT run against production until the matching app code (descriptive
-- questions + manual grading) is deployed; the new columns are nullable /
-- defaulted, so old code keeps working if the migration lands first.
--
-- What changes:
--   student_answers.answer_text     text        — the student's typed essay answer
--   student_answers.manual_marks    numeric     — marks awarded by the teacher (null = ungraded)
--   student_answers.graded_by       uuid        — teacher/admin who graded it
--   student_answers.graded_at       timestamptz — when it was graded
--   test_attempts.manual_grading_pending boolean — true while any submitted
--     descriptive answer in the attempt is still ungraded.
-- Descriptive questions carry their marks in test_questions.marks exactly
-- like MCQ questions (no extra max_marks column is needed). Their model
-- answer / grading guidance lives in the existing test_questions.explanation
-- column and is only shown to students after grading, gated by the test's
-- show_explanations setting (see src/app/api/tests/results/route.ts).
-- Scoring: descriptive answers score 0 automatically at submit time and
-- contribute only once a teacher saves manual_marks via
-- POST /api/tests/grade, which recomputes the attempt total.

-- ---------- Free-text answer + per-answer manual marks ----------
alter table public.student_answers add column if not exists answer_text text;
alter table public.student_answers add column if not exists manual_marks numeric;
alter table public.student_answers add column if not exists graded_by uuid references public.profiles(id) on delete set null;
alter table public.student_answers add column if not exists graded_at timestamptz;

-- NOTE: the 0..question.marks range for manual_marks is enforced server-side
-- in POST /api/tests/grade (Postgres CHECK constraints cannot contain
-- subqueries, so the range cannot be expressed as a column constraint).

-- ---------- Attempt-level "awaiting manual grading" flag ----------
alter table public.test_attempts add column if not exists manual_grading_pending boolean not null default false;

-- Backfill (safe to re-run): attempts that are already submitted and have a
-- non-empty descriptive answer with no manual mark yet are pending.
-- Descriptive questions are identified by test_questions.question_type.
update public.test_attempts a
set manual_grading_pending = true
where a.status in ('submitted', 'expired')
  and exists (
    select 1
    from public.student_answers sa
    join public.test_questions q on q.id = sa.question_id
    where sa.attempt_id = a.id
      and q.question_type = 'descriptive'
      and nullif(btrim(coalesce(sa.answer_text, '')), '') is not null
      and sa.manual_marks is null
  );

create index if not exists idx_test_attempts_pending_grading
  on public.test_attempts (test_id) where manual_grading_pending = true;

-- Verify: new columns exist (counts are 0 on a fresh install).
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('student_answers', 'test_attempts')
  and column_name in ('answer_text', 'manual_marks', 'graded_by', 'graded_at', 'manual_grading_pending')
order by table_name, column_name;
