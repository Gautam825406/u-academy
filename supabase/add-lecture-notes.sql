-- U++ Academy — ADD lecture watch progress + personal lecture notes
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- lecture_progress: one row per student per lecture — how many seconds
-- watched + whether completed. Powers "Resume from …" and "Watched ✓" in
-- the secure lecture player.
-- lecture_notes: the student's OWN private notes for a lecture (one row per
-- student per lecture). This is separate from the teacher's notes, which
-- live on the lectures row itself (plain text, or a Google Drive link the
-- teacher pastes in — the Drive file's sharing is the teacher's
-- responsibility; the app never changes Drive permissions).
-- Neither table grants access or changes payment/enrolment status — those
-- still come only from the Cashfree-verified return/webhook routes.

create table if not exists public.lecture_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  watched_seconds int not null default 0 check (watched_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (student_id, lecture_id)
);
create table if not exists public.lecture_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (student_id, lecture_id)
);

-- RLS: same permissive-authenticated pattern as schema.sql
-- (RLS enabled; refine per-row / per-batch in production if needed).
alter table public.lecture_progress enable row level security;
alter table public.lecture_notes enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['lecture_progress','lecture_notes']) loop
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

create index if not exists idx_lecture_progress_student on public.lecture_progress(student_id);
create index if not exists idx_lecture_progress_lecture on public.lecture_progress(lecture_id);
create index if not exists idx_lecture_progress_batch on public.lecture_progress(batch_id);
create index if not exists idx_lecture_notes_student on public.lecture_notes(student_id);
create index if not exists idx_lecture_notes_lecture on public.lecture_notes(lecture_id);

-- Verify: tables exist (counts start at 0).
select 'lecture_progress' as table_name, count(*) from public.lecture_progress
union all select 'lecture_notes', count(*) from public.lecture_notes;
